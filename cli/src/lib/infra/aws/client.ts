import { EC2 } from '@aws-sdk/client-ec2';

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
}
