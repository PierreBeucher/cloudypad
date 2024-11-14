import { input, select } from '@inquirer/prompts';
import { PartialDeep } from 'type-fest';
import { AwsClient } from '../../tools/aws';
import { InstanceInitializer, CommonInitConfig, StaticInitializerPrompts } from '../../core/initializer';
import { InstanceStateV1 } from '../../core/state';
import { getLogger } from '../../log/utils';
import { AwsProvisionConfigV1 } from './state';
import { CLOUDYPAD_PROVIDER_AWS } from '../../core/const';

export class AwsInstanceInitializer extends InstanceInitializer {

    private readonly defaultAwsConfig: PartialDeep<AwsProvisionConfigV1>

    constructor(genericArgs?: PartialDeep<CommonInitConfig>, defaultAwsConfig?: PartialDeep<AwsProvisionConfigV1>){
        super(genericArgs)
        this.defaultAwsConfig = defaultAwsConfig ?? {}
    }

    protected async promptProviderConfig(commonConfig: CommonInitConfig): Promise<InstanceStateV1> {
        const awsConfig = await new AwsInitializerPrompt().prompt(this.defaultAwsConfig)

        return {
            name: commonConfig.instanceName,
            version: "1",
            provision: {
                provider: CLOUDYPAD_PROVIDER_AWS,
                common: {
                    config: {
                        ssh: commonConfig.provisionConfig.ssh,
                    }
                },
                aws: {
                    config: awsConfig
                }
            }
        }

    }
}

export class AwsInitializerPrompt {

    private logger = getLogger(AwsInitializerPrompt.name)

    constructor(){
        
    }

    async prompt(args?: PartialDeep<AwsProvisionConfigV1>): Promise<AwsProvisionConfigV1> {

        this.logger.debug(`Starting AWS prompt with default opts: ${JSON.stringify(args)}`)

        const instanceType = await this.instanceType(args?.instanceType)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(args?.useSpot)
        const diskSize = await this.diskSize(args?.diskSize)
        const publicIpType = await this.publicIpType(args?.publicIpType)
        const region = await this.region(args?.region)

        return {
            diskSize: diskSize,
            instanceType: instanceType,
            publicIpType: publicIpType,
            region: region,
            useSpot: useSpot,
        }
    }

    private async instanceType(instanceType?: string): Promise<string> {
        if (instanceType) {
            return instanceType;
        }

        const choices = [
            "g4dn.xlarge", "g4dn.2xlarge", "g4dn.4xlarge",
            "g5.xlarge", "g5.2xlarge", "g5.4xlarge"
        ].sort().map(type => ({
            name: type,
            value: type,
        }))

        choices.push({name: "Let me type an instance type", value: "_"})

        const selectedInstanceType = await select({
            message: 'Choose an instance type:',
            default: "g4dn.xlarge",
            choices: choices,
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedInstanceType        
    }

    private async diskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize;
        }

        const selectedDiskSize = await input({
            message: 'Enter desired disk size (GB):',
            default: "100"
        });

        return Number.parseInt(selectedDiskSize)

    }

    private async publicIpType(publicIpType?: string): Promise<string> {
        if (publicIpType) {
            return publicIpType;
        }

        const publicIpTypeChoices = ['static', 'dynamic'].map(type => ({
            name: type,
            value: type,
        }));

        return await select({
            message: 'Use static Elastic IP or dynamic IP? :',
            choices: publicIpTypeChoices,
            default: 'static',
        });
    }

    private async region(region?: string): Promise<string> {
        if (region) {
            return region;
        }

        const currentAwsRegion = await AwsClient.getCurrentRegion()
        const regions = await AwsClient.listRegions()

        return await select({
            message: 'Select an AWS region to deploy instance:',
            choices: regions.map(r => ({
                name: r,
                value: r,
            })),
            loop: false,
            default: currentAwsRegion,
        })
    }

}
