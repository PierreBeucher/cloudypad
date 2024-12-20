import { input, select } from '@inquirer/prompts';
import { AwsClient } from '../../tools/aws';
import { AbstractInstanceInitializer, InstanceInitArgs, StaticInitializerPrompts } from '../../core/initializer';
import { CommonProvisionInputV1 } from '../../core/state/state';
import { AwsProvisionInputV1 } from './state';
import { CLOUDYPAD_PROVIDER_AWS } from '../../core/const';

export type AwsInstanceInitArgs = InstanceInitArgs<AwsProvisionInputV1>

export class AwsInstanceInitializer extends AbstractInstanceInitializer<AwsProvisionInputV1> {

    constructor(args: AwsInstanceInitArgs){
        super(CLOUDYPAD_PROVIDER_AWS, args)
    }

    async promptProviderConfig(commonInput: CommonProvisionInputV1): Promise<AwsProvisionInputV1> {
        this.logger.debug(`Starting AWS prompt with default opts: ${JSON.stringify(commonInput)}`)

        const instanceType = await this.instanceType(this.args.input.instanceType)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(this.args.input.useSpot)
        const diskSize = await this.diskSize(this.args.input.diskSize)
        const publicIpType = await StaticInitializerPrompts.publicIpType(this.args.input.publicIpType)
        const region = await this.region(this.args.input.region)

        const awsInput: AwsProvisionInputV1 = {
            ...commonInput,
            diskSize: diskSize,
            instanceType: instanceType,
            publicIpType: publicIpType,
            region: region,
            useSpot: useSpot,
        }

        return awsInput
        
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