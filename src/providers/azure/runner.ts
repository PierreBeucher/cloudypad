import { AbstractInstanceRunner, AbstractInstanceRunnerArgs } from '../../core/runner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionConfigV1, AzureProvisionOutputV1 } from './state'

export interface AzureInstanceRunnerArgs extends AbstractInstanceRunnerArgs{
    azConfig: AzureProvisionConfigV1,
    azOutput: AzureProvisionOutputV1,
}

export class AzureInstanceRunner extends AbstractInstanceRunner {

    private client: AzureClient

    private readonly azArgs: AzureInstanceRunnerArgs

    constructor(args: AzureInstanceRunnerArgs) {
        super(args)

        this.azArgs = args
        this.client = new AzureClient(args.instanceName, args.azConfig.subscriptionId)
    }

    private getVmName() {
        return this.azArgs.azOutput.vmName
    }

    private getResourceGroupName(){
        return this.azArgs.azOutput.resourceGroupName
    }

    async start() {
        await super.start()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName)
    }

    async stop() {
        await super.stop()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.stopInstance(resourceGroupName, vmName)
    }

    async restart() {
        await super.restart()
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName)
    }
}
