import { EC2, Instance } from '@aws-sdk/client-ec2';

export interface AwsClientArgs {
    region?: string;
}

export class AwsClient {

    private ec2: EC2;

    constructor(config: AwsClientArgs) {
        this.ec2 = new EC2({ region: config.region });
    }

    async startInstance(instanceId: string): Promise<void> {
        await this.ec2.startInstances({ InstanceIds: [instanceId] });
    }

    async stopInstance(instanceId: string): Promise<void> {
        await this.ec2.stopInstances({ InstanceIds: [instanceId] });
    }

    async rebootInstance(instanceId: string): Promise<void> {
        await this.ec2.rebootInstances({ InstanceIds: [instanceId] });
    }

    async getInstanceDetails(instanceId: string) : Promise<Instance> {
        const data = await this.ec2.describeInstances({ InstanceIds: [ instanceId ]})
        if (!data.Reservations || data.Reservations.length != 1 || !data.Reservations[0].Instances || data.Reservations[0].Instances.length != 1){
            throw new Error(`Couldn't get instance detail ${instanceId}. Got either none or too many instances: ${JSON.stringify(data)}`)
        }

        return data.Reservations[0].Instances[0]
        
    }
}
