import { AbstractInstanceRunner, InstanceRunnerArgs } from '../../core/runner'
import { AzureClient } from '../../tools/azure'
import { AzureProvisionConfigV1, AzureProvisionOutputV1 } from './state'

export type AzureInstanceRunnerArgs = InstanceRunnerArgs<AzureProvisionConfigV1, AzureProvisionOutputV1>

export class AzureInstanceRunner extends AbstractInstanceRunner<AzureProvisionConfigV1, AzureProvisionOutputV1>  {

    private client: AzureClient

    constructor(args: AzureInstanceRunnerArgs) {
        super(args)

        this.client = new AzureClient(args.instanceName, args.config.subscriptionId)
    }

    private getVmName() {
        return this.args.output.vmName
    }

    private getResourceGroupName(){
        return this.args.output.resourceGroupName
    }

    async doStart() {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.startInstance(resourceGroupName, vmName)
    }

    async doStop() {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.stopInstance(resourceGroupName, vmName)
    }

    async doRestart() {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName)
    }
}
