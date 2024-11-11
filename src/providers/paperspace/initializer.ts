import { select, input, password } from '@inquirer/prompts';
import { PartialDeep } from 'type-fest';
import { fetchApiKeyFromEnvironment } from './client/client';
import { getLogger } from '../../log/utils';
import { InstanceInitializer, CommonInitConfig } from '../../core/initializer';
import { InstanceStateV1 } from '../../core/state';
import { PaperspaceProvisionConfigV1 } from './state';
import { CLOUDYPAD_PROVIDER_PAPERSPACE } from '../../core/const';

export class PaperspaceInstanceInitializer extends InstanceInitializer {

    private readonly defaultPaperspaceConfig: PartialDeep<PaperspaceProvisionConfigV1>

    constructor(defaultCommonConfig?: PartialDeep<CommonInitConfig>, defaultPaperspaceConfig?: PartialDeep<PaperspaceProvisionConfigV1>){
        super(defaultCommonConfig)
        this.defaultPaperspaceConfig = defaultPaperspaceConfig ?? {}
    }

    protected async promptProviderConfig(commonConfig: CommonInitConfig): Promise<InstanceStateV1> {
        const pspaceConfig = await new PaperspaceInitializerPrompt().prompt(this.defaultPaperspaceConfig)

        return {
            name: commonConfig.instanceName,
            version: "1",
            provision: {
                provider: CLOUDYPAD_PROVIDER_PAPERSPACE,
                common: {
                    config: {
                        ssh: commonConfig.provisionConfig.ssh,
                    }
                },
                paperspace: {
                    config: pspaceConfig
                }
            }
        }
    }
    
}

export class PaperspaceInitializerPrompt {
    
    protected readonly logger = getLogger(PaperspaceInitializerPrompt.name)

    async prompt(opts?: PartialDeep<PaperspaceProvisionConfigV1>) : Promise<PaperspaceProvisionConfigV1> {
        
        const apiKey = await this.apiKey(opts?.apiKey)
        const machineType = await this.machineType(opts?.machineType);
        const diskSize = await this.diskSize(opts?.diskSize);
        const publicIpType = await this.publicIpType(opts?.publicIpType);
        const region = await this.region(opts?.region);
        
        return {
            apiKey: apiKey,
            diskSize: diskSize,
            machineType: machineType,
            publicIpType: publicIpType,
            region: region
        }

    }

    protected async machineType(machineType?: string): Promise<string> {
        if (machineType) {
            return machineType;
        }

        const choices = ['M4000', 'P4000', 'A4000', 'RTX4000', 'P5000', 'RTX5000', 'P6000', 'A5000', 'A6000' ].sort().map(type => ({ name: type, value: type }))
        choices.push({name: "Let me type an instance type", value: "_"})
        
        const selectedInstanceType = await select({
            message: 'Select machine type:',
            loop: false,
            choices: choices,
            default: "RTX4000"
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedInstanceType
    }

    protected async diskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize;
        }

        const selectedDiskSize = await select({
            message: 'Select disk size (GB):',
            choices: ['50', '100', '250', '500', '1000', '2000'].map(size => ({ name: size, value: size })),
        });

        return Number.parseInt(selectedDiskSize);
    }

    protected async publicIpType(publicIpType?: string): Promise<'static' | 'dynamic'> {
        if (publicIpType) {
            if (publicIpType !== 'static' && publicIpType !== 'dynamic') {
                throw new Error(`Unknown IP type ${publicIpType}, must be 'static' or 'dynamic'`)
            }
            return publicIpType;
        }
        
        return 'static';
    }

    protected async region(region?: string): Promise<string> {
        if (region) {
            return region;
        }

        return await select({
            message: 'Select region for new machine:',
            choices: ['East Coast (NY2)', 'West Coast (CA1)', 'Europe (AMS1)'].map(r => ({ name: r, value: r }))
        });
    }

    protected async apiKey(apiKey?: string): Promise<string>{
        if (apiKey) return apiKey

        const envApiKey = fetchApiKeyFromEnvironment() 

        if(envApiKey.length == 0) {
            return await password({
                message: 'No Paperspace API Key found. Restart with environment variable PAPERSPACE_API_KEY or enter API Key:'
            });
        } else if(envApiKey.length == 1){
            return envApiKey[0]
        } else {
            throw new Error("Found multiple keys in your Paperspace home config. Please specify a single key suing either PAPERSPACE_API_KEY." +
                "(Later version will support multiple keys and let you specify a team to choose from)")
        }
    }

}