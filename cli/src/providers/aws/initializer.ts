import { input, select, confirm } from '@inquirer/prompts';
import { loadConfig } from "@smithy/node-config-provider";
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from "@smithy/config-resolver";
import { PartialDeep } from 'type-fest';
import { AWSProvisionArgs } from './provisioner';
import { AwsClient } from '../../tools/aws';

export class AwsInitializerPrompt {

    private awsClient: AwsClient
    constructor(){
        this.awsClient = new AwsClient()
    }

    async prompt(opts?: PartialDeep<AWSProvisionArgs>): Promise<AWSProvisionArgs> {

        await this.awsClient.checkAwsAuth()

//         let useExisting: boolean;

//         if (opts?.useExisting?.instanceId) {
//             useExisting = true
//         } else {
//             useExisting = await select({
//                 message: 'Do you want to use an existing machine or create a new one?',
//                 default: "Create a new machine",
//                 choices: [{
//                     name: "Create a new machine",
//                     value: false,
//                 }, {
//                     name: "Use an existing machine",
//                     value: true
//                 }]
//             })
//         }

//         if (useExisting) {
//             const continueUseExisting = await confirm({
//                 message: `Using an existing AWS EC2 instance will skip most Cloud-related configuration such as firewall and public hostname setup and may may disrupt already installed applications on existing machine.
// Though future version may help in configuring existing instances, it's not supported yet. 
// If you're not sure about what you're doing, it's recommended to create a new AWS machine for Cloudy Pad. Continue?`,
//                 default: false,
//             });

//             if(!continueUseExisting){
//                 throw new Error("Won't re-use existing instance")
//             }

//             const [instanceId, instancePublicIP] = await this.existingInstanceId(opts?.useExisting?.instanceId);

//             return {
//                 useExisting: {
//                     instanceId: instanceId,
//                     publicIp: instancePublicIP
//                 }
//             }

//         } else {
            const instanceType = await this.instanceType(opts?.create?.instanceType);
            const diskSize = await this.diskSize(opts?.create?.diskSize);
            const publicIpType = await this.publicIpType(opts?.create?.publicIpType);
            const region = await this.region(opts?.create?.region);

            return {
                create: {
                    diskSize: diskSize,
                    instanceType: instanceType,
                    publicIpType: publicIpType,
                    region: region
                }
            }
        // }
    }

    private async existingInstanceId(existingInstanceId?: string) {

        if (existingInstanceId) {
            return existingInstanceId;
        }

        const instances = await this.awsClient.listInstances()
        const instanceChoices = instances.map((instance) => {
            const nameTag = instance.Tags?.find(tag => tag.Key === 'Name')?.Value;

            const ipPrompt = instance.PublicIpAddress ? `Public IP: ${instance.PublicIpAddress}` : 'No public IP'
            const tagPrompt = nameTag ? `Name: ${nameTag}` : 'No name'

            return {
                name: `${instance.InstanceId} (${tagPrompt}, ${ipPrompt})`,
                value: instance.InstanceId,
            }
        });

        const instanceSelection = await select({
            message: 'Select an existing AWS instance:',
            choices: instanceChoices,
        });

        const selectedInstance = instances.find(instance => instance.InstanceId === instanceSelection);

        if (!selectedInstance) {
            throw new Error('Selected instance not found.');
        }

        if (!selectedInstance.InstanceId) {
            throw new Error('Selected instance does not have an instance ID.');
        }

        if (!selectedInstance.PublicIpAddress) {
            throw new Error("Selected instance does not have a public IP address. May it's stopped or does not have an Elastic IP association ?")
        }

        return [selectedInstance.InstanceId, selectedInstance.PublicIpAddress]
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
