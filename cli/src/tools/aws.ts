import { EC2Client, DescribeInstancesCommand, Instance, StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand } from '@aws-sdk/client-ec2';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

export class AwsClient {

    private readonly ec2Client: EC2Client
    private readonly stsClient: STSClient

    constructor(){
        this.ec2Client = new EC2Client({});
        this.stsClient = new STSClient({});
    }
    async checkAwsAuth() {
        try {
            const callerIdentity = await this.stsClient.send(new GetCallerIdentityCommand({}));
            console.info(`Currently authenticated as ${callerIdentity.UserId} on account ${callerIdentity.Account}`)
        } catch (e) {
            throw new Error(`Couldn't check AWS authentication: ${JSON.stringify(e)}`)
        }
    }

    async listInstances(): Promise<Instance[]>{
        const describeInstancesCommand = new DescribeInstancesCommand({});
        const instancesData = await this.ec2Client.send(describeInstancesCommand);
        const instances = instancesData.Reservations?.flatMap(reservation => reservation.Instances).filter(instance => instance !== undefined) || [];
        return instances
    }

    async startInstance(instanceId: string){
        try {
            const command = new StartInstancesCommand({
                InstanceIds: [instanceId],
            })
            await this.ec2Client.send(command)
            console.log(`EC2 instance ${instanceId}) is starting...`)
        } catch (error) {
            console.error(`Failed to start EC2 instance ${instanceId}:`, error);
        }
    }


    async stopInstance(instanceId: string) {
        try {
            const command = new StopInstancesCommand({
                InstanceIds: [instanceId],
            });
            await this.ec2Client.send(command);
            console.log(`EC2 instance ${instanceId} is stopping...`);
        } catch (error) {
            console.error(`Failed to stop EC2 instance ${instanceId}:`, error);
        }
    }
    
    async restartInstance(instanceId: string) {
        try {
            const rebootCommand = new RebootInstancesCommand({
                InstanceIds: [instanceId],
            });
            await this.ec2Client.send(rebootCommand);
            console.log(`EC2 instance ${instanceId} is restarting...`);
        } catch (error) {
            console.error(`Failed to restart EC2 instance ${instanceId}:`, error);
        }
    }
}