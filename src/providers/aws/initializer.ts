import { input, select } from '@inquirer/prompts';
import { loadConfig } from "@smithy/node-config-provider";
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from "@smithy/config-resolver";
import { PartialDeep } from 'type-fest';
import { AwsClient } from '../../tools/aws';
import { InstanceInitializer, GenericInitializationArgs, StaticInitializerPrompts } from '../../core/initializer';
import { StateManager } from '../../core/state';
import { AwsProvisioner } from './provisioner';
import { AwsInstanceRunner } from './runner';
import { getLogger } from '../../log/utils';
import { InstanceProvisionOptions } from '../../core/provisioner';

export interface AwsProvisionArgs {
    create?: {
        instanceType: string
        diskSize: number
        publicIpType: string
        region: string
        useSpot: boolean
    }
}

export class AwsInstanceInitializer extends InstanceInitializer {

    private readonly defaultAwsArgs: PartialDeep<AwsProvisionArgs>

    constructor(genericArgs?: PartialDeep<Omit<GenericInitializationArgs, "provider">>, defaultAwsArgs?: PartialDeep<AwsProvisionArgs>){
        super(genericArgs)
        this.defaultAwsArgs = defaultAwsArgs ?? {}
    }

    protected async runProvisioning(sm: StateManager, opts: InstanceProvisionOptions) {
        const args = await new AwsInitializerPrompt().prompt(this.defaultAwsArgs)

        this.logger.debug(`Running AWS provision with args: ${JSON.stringify(args)}`)
        
        sm.update({ 
            ssh: {
                user: "ubuntu"
            },
            provider: { aws: { provisionArgs: args }}
        })

        await new AwsProvisioner(sm).provision(opts)
    }

    protected async runPairing(sm: StateManager) {
        await new AwsInstanceRunner(sm).pair()
    }
    
}

export class AwsInitializerPrompt {

    private logger = getLogger(AwsInitializerPrompt.name)

    private awsClient: AwsClient
    constructor(){
        this.awsClient = new AwsClient(AwsInitializerPrompt.name)
    }

    async prompt(args?: PartialDeep<AwsProvisionArgs>): Promise<AwsProvisionArgs> {

        this.logger.debug(`Starting AWS prompt with default opts: ${JSON.stringify(args)}`)

        const instanceType = await this.instanceType(args?.create?.instanceType)
        const useSpot = await StaticInitializerPrompts.useSpotInstance(args?.create?.useSpot)
        const diskSize = await this.diskSize(args?.create?.diskSize)
        const publicIpType = await this.publicIpType(args?.create?.publicIpType)
        const region = await this.region(args?.create?.region)

        return {
            create: {
                diskSize: diskSize,
                instanceType: instanceType,
                publicIpType: publicIpType,
                region: region,
                useSpot: useSpot,
            }
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

        const currentAwsRegion = await this.getCurrentRegion()

        return await input({
            message: 'Enter AWS region to use:',
            default: currentAwsRegion,
        });
    }

    private async getCurrentRegion(): Promise<string> {
        // AWS SDK V3 does not provide an easy way to get current region
        // Use this method taken from https://github.com/aws/aws-sdk-js-v3/discussions/4488
        return await loadConfig(NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS)()
    }

}
