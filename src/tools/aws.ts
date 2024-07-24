import { EC2Client, DescribeInstancesCommand, Instance, StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand } from '@aws-sdk/client-ec2';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { getLogger, Logger } from '../log/utils';

export class AwsClient {

    private readonly ec2Client: EC2Client
    private readonly stsClient: STSClient
    private readonly logger: Logger

    constructor(name: string){
        this.logger = getLogger(name)
        this.ec2Client = new EC2Client({});
        this.stsClient = new STSClient({});
    }
    async checkAwsAuth() {
        this.logger.debug("Checking AWS authentication")
        try {
            const callerIdentity = await this.stsClient.send(new GetCallerIdentityCommand({}));
            this.logger.debug(`Currently authenticated as ${callerIdentity.UserId} on account ${callerIdentity.Account}`)
        } catch (e) {
            this.logger.error(`Couldn't check AWS authentication: ${JSON.stringify(e)}`)
            this.logger.error(`Is your local AWS authentication configured ?`)
            
            throw new Error(`Couldn't check AWS authentication: ${JSON.stringify(e)}`)
        }
    }

    async listInstances(): Promise<Instance[]>{
        const describeInstancesCommand = new DescribeInstancesCommand({});

        this.logger.debug(`Listing AWS instances: ${JSON.stringify(describeInstancesCommand)}`)

        const instancesData = await this.ec2Client.send(describeInstancesCommand);
        
        this.logger.trace(`Describe instances response: ${JSON.stringify(instancesData)}`)
        
        const instances = instancesData.Reservations?.flatMap(reservation => reservation.Instances).filter(instance => instance !== undefined) || [];
        return instances
    }

    async startInstance(instanceId: string){
        try {
            const command = new StartInstancesCommand({
                InstanceIds: [instanceId],
            })

            this.logger.debug(`Starting AWS instance: ${JSON.stringify(command)}`)

            const result = await this.ec2Client.send(command)
            
            this.logger.trace(`Starting EC2 instance response ${JSON.stringify(result)}`)
            
        } catch (error) {
            this.logger.error(`Failed to start EC2 instance ${instanceId}:`, error)
            throw error
        }
    }

    async stopInstance(instanceId: string) {
        try {
            const command = new StopInstancesCommand({
                InstanceIds: [instanceId],
            });

            this.logger.debug(`Stopping instance: ${JSON.stringify(command)}`)

            const result = await this.ec2Client.send(command);

            this.logger.trace(`Stopping EC2 instance response ${JSON.stringify(result)}`)

        } catch (error) {
            this.logger.error(`Failed to stop EC2 instance ${instanceId}:`, error)
            throw error
        }
    }
    
    async restartInstance(instanceId: string) {
        try {
            const rebootCommand = new RebootInstancesCommand({
                InstanceIds: [instanceId],
            });

            this.logger.debug(`Restarting instance: ${JSON.stringify(rebootCommand)}`)

            const result = await this.ec2Client.send(rebootCommand);
            
            this.logger.trace(`Restarting EC2 instance response ${JSON.stringify(result)}`)

        } catch (error) {
            this.logger.error(`Failed to restart EC2 instance ${instanceId}:`, error)
            throw error
        }
    }
}
