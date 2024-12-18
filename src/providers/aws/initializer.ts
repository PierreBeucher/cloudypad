import { input, select } from '@inquirer/prompts';
import { AwsClient } from '../../tools/aws';
import { InstanceInitArgs, InstanceInitializer, StaticInitializerPrompts } from '../../core/initializer';
import { CommonProvisionConfigV1 } from '../../core/state/state';
import { AwsInstanceStateV1, AwsProvisionConfigV1, AwsProvisionOutputV1 } from './state';
import { InstanceManager } from '../../core/manager';
import { AwsInstanceManager } from './manager';
import { CLOUDYPAD_PROVIDER_AWS } from '../../core/const';

export type AwsInstanceInitArgs = InstanceInitArgs<AwsProvisionConfigV1>

export class AwsInstanceInitializer extends InstanceInitializer<AwsProvisionConfigV1, AwsProvisionOutputV1> {

    constructor(args: AwsInstanceInitArgs){
        super(CLOUDYPAD_PROVIDER_AWS, args)
    }

    protected async buildInstanceManager(state: AwsInstanceStateV1): Promise<InstanceManager> {
        return new AwsInstanceManager(state)
    }

    async promptProviderConfig(commonConfig: CommonProvisionConfigV1): Promise<AwsProvisionConfigV1> {
        this.logger.debug(`Starting AWS prompt with default opts: ${JSON.stringify(commonConfig)}`)

        const instanceType = await this.instanceType(this.args.config.instanceType)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(this.args.config.useSpot)
        const diskSize = await this.diskSize(this.args.config.diskSize)
        const publicIpType = await this.publicIpType(this.args.config.publicIpType)
        const region = await this.region(this.args.config.region)

        const awsConfig: AwsProvisionConfigV1 = {
            ...commonConfig,
            diskSize: diskSize,
            instanceType: instanceType,
            publicIpType: publicIpType,
            region: region,
            useSpot: useSpot,
        }

        return awsConfig
        
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