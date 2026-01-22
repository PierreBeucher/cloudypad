import { SshKeyLoader } from '../../tools/ssh'
import { ScalewayPulumiClient, PulumiStackConfigScaleway } from './pulumi/main'
import { ScalewayDataDiskSnapshotPulumiClient} from './pulumi/snapshot'
import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner'
import { ScalewayProvisionInputV1, ScalewayProvisionOutputV1 } from './state'
import { ScalewayClient } from './sdk-client'
import { DATA_DISK_STATE_LIVE, DATA_DISK_STATE_SNAPSHOT } from '../../core/const'

export type ScalewayProvisionerArgs = InstanceProvisionerArgs<ScalewayProvisionInputV1, ScalewayProvisionOutputV1>

export class ScalewayProvisioner extends AbstractInstanceProvisioner<ScalewayProvisionInputV1, ScalewayProvisionOutputV1> {

    constructor(args: ScalewayProvisionerArgs) {
        super(args)
    }

    private buildMainPulumiClient(): ScalewayPulumiClient {
        const pulumiClient = new ScalewayPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildSnapshotPulumiClient(): ScalewayDataDiskSnapshotPulumiClient {
        const pulumiClient = new ScalewayDataDiskSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doDataSnapshotProvision(opts?: ProvisionerActionOptions): Promise<ScalewayProvisionOutputV1> {
        this.logger.info(`Data snapshot provision for Scaleway instance ${this.args.instanceName}`)

        // If data disk snapshot feature is not enabled, return current output as-is
        if (!this.args.provisionInput.dataDiskSnapshot?.enable) {
            throw new Error(`Data disk snapshot is not enabled for instance ${this.args.instanceName}, this function should not be called. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        const snapshotClient = this.buildSnapshotPulumiClient()

        // don't run Pulumi if there's no data disk ID to snapshot
        // or desired state is set to LIVE (in which case snapshot update is not needed)
        if (!this.args.provisionOutput?.dataDiskId || this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_LIVE) {
            this.logger.debug(`No data disk ID to snapshot, returning current Pulumi output as-is`)

            const currentSnapshotPulumiOutput = await snapshotClient.getOutputs()
            return {
                ...this.getCurrentProvisionOutput(),
                dataDiskSnapshotId: currentSnapshotPulumiOutput?.snapshotId,
            }
        }

        this.logger.debug(`Creating data disk snapshot for instance ${this.args.instanceName}`)
        
        await snapshotClient.setConfig({
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            // may be undefined, in which case simply no-op and will have undefined snapshot ID in output
            baseVolumeId: this.args.provisionOutput?.dataDiskId,
        })
        const snapshotOutput = await snapshotClient.up()

        this.logger.debug(`Data disk snapshot output: ${JSON.stringify(snapshotOutput)}`)

        // Return output with snapshot info
        return {
            ...this.getCurrentProvisionOutput(),
            dataDiskSnapshotId: snapshotOutput?.snapshotId ?? undefined,
        }
    }

    async doMainProvision(opts?: ProvisionerActionOptions): Promise<ScalewayProvisionOutputV1> {
        this.logger.info(`Main provision for Scaleway instance ${this.args.instanceName}`)
        this.logger.debug(`Main provision with args ${JSON.stringify(this.args)}`)

        if (this.args.provisionInput.deleteInstanceServerOnStop && !this.args.provisionInput.imageId) {
            throw new Error(`Instance server deletion on stop is enabled but no image ID is provided. `
                + `This would cause configuration (NVIDIA driver install, etc.) to be missing on next start. `
                + `Provide an image ID to use for instance server creation or disable instance server deletion on stop.`
            )
        }

        // Build and run main Pulumi stack
        const pulumiClient = this.buildMainPulumiClient()
        const stackConfig = this.buildMainPulumiConfig()
        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return {
            ...this.getCurrentProvisionOutput(),
            host: pulumiOutputs.publicIp,
            publicIPv4: pulumiOutputs.publicIp,
            instanceServerName: pulumiOutputs.instanceServerName ?? undefined,
            instanceServerId: pulumiOutputs.instanceServerId ?? undefined,
            dataDiskId: pulumiOutputs.dataDiskId ?? undefined,
            rootDiskId: pulumiOutputs.rootDiskId ?? undefined,
        }

    }

    /**
     * Build current output from args, used when no changes are made.
     */
    private getCurrentProvisionOutput(): ScalewayProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceServerName: this.args.provisionOutput?.instanceServerName,
            instanceServerId: this.args.provisionOutput?.instanceServerId,
            dataDiskId: this.args.provisionOutput?.dataDiskId,
            rootDiskId: this.args.provisionOutput?.rootDiskId,
            dataDiskSnapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
        }
    }

    /**
     * Build Pulumi config from provision input, including runtime state.
     */
    private buildMainPulumiConfig(): PulumiStackConfigScaleway {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        return {
            projectId: this.args.provisionInput.projectId,
            region: this.args.provisionInput.region,
            zone: this.args.provisionInput.zone,
            instanceType: this.args.provisionInput.instanceType,
            instanceServerState: this.args.provisionInput.runtime?.instanceServerState,
            rootDisk: {
                sizeGb: this.args.provisionInput.diskSizeGb,
            },
            dataDisk: this.args.provisionInput.dataDiskSizeGb ? {
                // only absent is desired data disk state is explicitly set to snapshot
                // if absent or live, data should be present
                state: this.args.provisionInput.runtime?.dataDiskState === DATA_DISK_STATE_SNAPSHOT ? "absent" : "present",
                sizeGb: this.args.provisionInput.dataDiskSizeGb,
                // Use data disk snapshot ID if any (for restoration)
                snapshotId: this.args.provisionOutput?.dataDiskSnapshotId,
            } : undefined,
            imageId: this.args.provisionInput.imageId,
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: sshPublicKeyContent,
        }
    }

    async doDestroy(opts?: ProvisionerActionOptions) {
        this.logger.info(`Destroying Scaleway instance ${this.args.instanceName}`)

        const pulumiClient = this.buildMainPulumiClient()
        await pulumiClient.destroy({ cancel: opts?.pulumiCancel })

        // Also destroy snapshot stack if it exists
        if (this.args.provisionOutput?.dataDiskSnapshotId) {
            await this.doDestroySnapshotStack(opts)
        }

        this.args.provisionOutput = undefined
    }

    /**
     * Destroy the snapshot Pulumi stack.
     */
    private async doDestroySnapshotStack(opts?: ProvisionerActionOptions): Promise<void> {
        this.logger.info(`Destroying data disk snapshot stack for instance ${this.args.instanceName}`)
        const snapshotClient = this.buildSnapshotPulumiClient()
        await snapshotClient.destroy({ cancel: opts?.pulumiCancel })
    }

    protected async doVerifyConfig(): Promise<void> {
        ScalewayClient.checkLocalConfig()
    }

}
