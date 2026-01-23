import { AbstractInstanceProvisioner, InstanceProvisionerArgs, ProvisionerActionOptions } from '../../core/provisioner'
import { LinodePulumiClient, PulumiStackConfigLinode, LinodePulumiOutput } from './pulumi'
import { LinodeBaseImageSnapshotPulumiClient } from './pulumi-base-image-snapshot'
import { LinodeProvisionInputV1, LinodeProvisionOutputV1 } from './state'
import { SshKeyLoader } from '../../tools/ssh'
import { LinodeClient } from './sdk-client'
import { INSTANCE_SERVER_STATE_ABSENT } from '../../core/const'

export type LinodeProvisionerArgs = InstanceProvisionerArgs<LinodeProvisionInputV1, LinodeProvisionOutputV1>

export class LinodeProvisioner extends AbstractInstanceProvisioner<LinodeProvisionInputV1, LinodeProvisionOutputV1> {

    constructor(args: LinodeProvisionerArgs){
        super(args)
    }

    private buildPulumiClient(): LinodePulumiClient {
        const pulumiClient = new LinodePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    private buildBaseImageSnapshotPulumiClient(): LinodeBaseImageSnapshotPulumiClient {
        const pulumiClient = new LinodeBaseImageSnapshotPulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doMainProvision(opts?: ProvisionerActionOptions) {

        this.logger.info(`Provisioning Linode instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Linode instance with args ${JSON.stringify(this.args)}`)

        const pulumiClient = this.buildPulumiClient()
        const stackConfig = this.buildPulumiConfig()

        this.logger.debug(`Pulumi config: ${JSON.stringify(stackConfig)}`)

        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up({ cancel: opts?.pulumiCancel })

        return this.pulumiOutputsToProvisionOutput(pulumiOutputs)
    }

    async doBaseImageSnapshotProvision(opts?: ProvisionerActionOptions): Promise<LinodeProvisionOutputV1> {
        this.logger.info(`Base image snapshot provision for Linode instance ${this.args.instanceName}`)

        // If imageId is set in input, use it directly as passthrough (user provides their own image)
        if (this.args.provisionInput.imageId) {
            this.logger.debug(`Using provided imageId as baseImageId passthrough: ${this.args.provisionInput.imageId}`)
            return {
                ...this.getCurrentProvisionOutput(),
                baseImageId: this.args.provisionInput.imageId,
            }
        }

        // Root disk ID and instance server ID are required to create an image
        if (!this.args.provisionOutput?.rootDiskId || !this.args.provisionOutput?.instanceServerId) {
            throw new Error(`Root disk ID and instance server ID are required to create base image for instance ${this.args.instanceName}. ` +
                `This is an internal error, please report an issue. Full args: ${JSON.stringify(this.args)}, options: ${JSON.stringify(opts)}`
            )
        }

        this.logger.debug(`Creating base image for instance ${this.args.instanceName}`)

        const apiToken = this.args.provisionInput.apiToken ?? process.env.LINODE_TOKEN
        if(!apiToken) {
            throw new Error('Linode API token is required. Linode API token must be set either in state or as LINODE_TOKEN environment variable.')
        }

        const baseImageClient = this.buildBaseImageSnapshotPulumiClient()
        
        await baseImageClient.setConfig({
            apiToken: apiToken,
            diskId: parseInt(this.args.provisionOutput.rootDiskId),
            linodeId: parseInt(this.args.provisionOutput.instanceServerId),
        })
        const imageOutput = await baseImageClient.up()

        this.logger.debug(`Base image output: ${JSON.stringify(imageOutput)}`)

        return {
            ...this.getCurrentProvisionOutput(),
            baseImageId: imageOutput?.imageId ?? undefined,
        }
    }

    async doDestroy(opts?: ProvisionerActionOptions){
        const pulumiClient = this.buildPulumiClient()
        
        await pulumiClient.destroy({ cancel: opts?.pulumiCancel })

        // Also destroy base image stack if it exists (and not a passthrough from input imageId)
        if (this.args.provisionOutput?.baseImageId && !this.args.provisionInput.imageId) {
            await this.doDestroyBaseImageSnapshotStack(opts)
        }

        this.args.provisionOutput = undefined
    }

    /**
     * Destroy the base image snapshot Pulumi stack.
     */
    private async doDestroyBaseImageSnapshotStack(opts?: ProvisionerActionOptions): Promise<void> {
        this.logger.info(`Destroying base image snapshot stack for instance ${this.args.instanceName}`)
        const baseImageClient = this.buildBaseImageSnapshotPulumiClient()
        await baseImageClient.destroy({ cancel: opts?.pulumiCancel })
    }

    /**
     * Build current output from args, used when no changes are made.
     */
    private getCurrentProvisionOutput(): LinodeProvisionOutputV1 {
        return {
            host: this.args.provisionOutput?.host ?? '',
            publicIPv4: this.args.provisionOutput?.publicIPv4,
            instanceServerName: this.args.provisionOutput?.instanceServerName,
            instanceServerId: this.args.provisionOutput?.instanceServerId,
            dataDiskId: this.args.provisionOutput?.dataDiskId ?? '',
            rootDiskId: this.args.provisionOutput?.rootDiskId,
            baseImageId: this.args.provisionOutput?.baseImageId,
        }
    }

    private buildPulumiConfig(): PulumiStackConfigLinode {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        const apiToken = this.args.provisionInput.apiToken ?? process.env.LINODE_TOKEN
        if(!apiToken) {
            throw new Error('Linode API token is required. Linode API token must be set either in state or as LINODE_TOKEN environment variable.')
        }

        // Prefer baseImageId from output (our image or passthrough) over input imageId
        const imageId = this.args.provisionOutput?.baseImageId ?? this.args.provisionInput.imageId

        return {
            region: this.args.provisionInput.region,
            instanceType: this.args.provisionInput.instanceType,
            rootDisk: {
                sizeGb: this.args.provisionInput.rootDiskSizeGb,
            },
            dataDisk: this.args.provisionInput.dataDiskSizeGb ? {
                sizeGb: this.args.provisionInput.dataDiskSizeGb,
            } : undefined,
            imageId: imageId,
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: sshPublicKeyContent,
            noInstanceServer: this.args.provisionInput.runtime?.instanceServerState === INSTANCE_SERVER_STATE_ABSENT,
            watchdogEnabled: this.args.provisionInput.watchdogEnabled,
            apiToken: apiToken,
            dns: this.args.provisionInput.dns ? {
                domainName: this.args.provisionInput.dns.domainName,
                record: this.args.provisionInput.dns.record,
            } : undefined,
        }
    }

    private pulumiOutputsToProvisionOutput(pulumiOutputs: LinodePulumiOutput): LinodeProvisionOutputV1 {
        return {
            host: pulumiOutputs.instanceHostname ?? "unknown",
            publicIPv4: pulumiOutputs.instanceIPv4,
            instanceServerName: pulumiOutputs.instanceServerName,
            instanceServerId: pulumiOutputs.instanceServerId,
            dataDiskId: pulumiOutputs.dataDiskId,
            rootDiskId: pulumiOutputs.rootDiskId,
            // Preserve baseImageId from previous output if any
            baseImageId: this.args.provisionOutput?.baseImageId,
        }
    }

    async doVerifyConfig(){
        this.logger.debug(`Verifying Linode configuration for ${this.args.instanceName}`)

        // throws on error
        LinodeClient.checkAndSetupToken()
    }

} 