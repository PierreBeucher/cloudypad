import { select, input, password } from '@inquirer/prompts';
import { fetchApiKeyFromEnvironment } from './client/client';
import { AbstractInstanceInitializer, InstanceInitArgs } from '../../core/initializer';
import { CommonProvisionConfigV1 } from '../../core/state/state';
import { PaperspaceProvisionConfigV1 } from './state';
import { CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../../core/const';

export type PaperspaceInstanceInitArgs = InstanceInitArgs<PaperspaceProvisionConfigV1>

export class PaperspaceInstanceInitializer extends AbstractInstanceInitializer<PaperspaceProvisionConfigV1> {

    constructor(args: PaperspaceInstanceInitArgs){
        super(CLOUDYPAD_PROVIDER_PAPERSPACE, args)
    }

    async promptProviderConfig(commonConfig: CommonProvisionConfigV1): Promise<PaperspaceProvisionConfigV1> {
        
        const apiKey = await this.apiKey(this.args.config.apiKey)
        const machineType = await this.machineType(this.args.config.machineType);
        const diskSize = await this.diskSize(this.args.config.diskSize);
        const publicIpType = await this.publicIpType(this.args.config.publicIpType);
        const region = await this.region(this.args.config.region);
        
        const pspaceConf: PaperspaceProvisionConfigV1 = {
            ...commonConfig,
            apiKey: apiKey,
            diskSize: diskSize,
            machineType: machineType,
            publicIpType: publicIpType,
            region: region
        }

        return pspaceConf
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

    protected async publicIpType(publicIpType?: string): Promise<PUBLIC_IP_TYPE> {
        if (publicIpType) {
            if (publicIpType !== PUBLIC_IP_TYPE_STATIC && publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
                throw new Error(`Unknown IP type ${publicIpType}, must be '${PUBLIC_IP_TYPE_STATIC}' or '${PUBLIC_IP_TYPE_DYNAMIC}'`)
            }
            return publicIpType;
        }
        
        return PUBLIC_IP_TYPE_STATIC;
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