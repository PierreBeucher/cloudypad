import { CLOUDYPAD_PROVIDER_AZURE } from '../../core/const'
import { AbstractInstanceRunner, InstanceRunnerArgs, InstanceRunningStatus, StartStopOptions } from '../../core/runner'
import { AzureClient, AzureVmStatus } from '../../tools/azure'
import { AzureProvisionInputV1, AzureProvisionOutputV1 } from './state'

export type AzureInstanceRunnerArgs = InstanceRunnerArgs<AzureProvisionInputV1, AzureProvisionOutputV1>

export class AzureInstanceRunner extends AbstractInstanceRunner<AzureProvisionInputV1, AzureProvisionOutputV1>  {

    private client: AzureClient

    constructor(args: AzureInstanceRunnerArgs) {
        super(CLOUDYPAD_PROVIDER_AZURE, args)

        this.client = new AzureClient(args.instanceName, args.provisionInput.subscriptionId)
    }

    private getVmName() {
        return this.args.provisionOutput.vmName
    }

    private getResourceGroupName(){
        return this.args.provisionOutput.resourceGroupName
    }

    async doStart(opts?: StartStopOptions) {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.startInstance(resourceGroupName, vmName, {
            wait: opts?.wait,
        })
    }

    async doStop(opts?: StartStopOptions) {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.stopInstance(resourceGroupName, vmName, opts)
    }

    async doRestart(opts?: StartStopOptions) {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        await this.client.restartInstance(resourceGroupName, vmName, opts)
    }

    async doGetInstanceStatus(): Promise<InstanceRunningStatus> {
        const vmName = this.getVmName()
        const resourceGroupName = this.getResourceGroupName()

        const status = await this.client.getInstanceStatus(resourceGroupName, vmName)

        switch(status) {
            case AzureVmStatus.Running:
                return InstanceRunningStatus.Running
            case AzureVmStatus.Deallocated:
                return InstanceRunningStatus.Stopped
            case AzureVmStatus.Starting:
                return InstanceRunningStatus.Starting
            case AzureVmStatus.Deallocating:
                return InstanceRunningStatus.Stopping
            case AzureVmStatus.Unknown:
                return InstanceRunningStatus.Unknown
            default:
                return InstanceRunningStatus.Unknown
        }
    }
}
