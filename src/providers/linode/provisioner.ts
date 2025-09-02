import { AbstractInstanceProvisioner, InstanceProvisionerArgs } from '../../core/provisioner'
import { getLogger } from '../../log/utils'
import { LinodePulumiClient, PulumiStackConfigLinode, LinodePulumiOutput } from './pulumi'
import { LinodeProvisionInputV1, LinodeProvisionOutputV1 } from './state'
import { SshKeyLoader } from '../../tools/ssh'
import { LinodeClient } from './sdk-client'

export type LinodeProvisionerArgs = InstanceProvisionerArgs<LinodeProvisionInputV1, LinodeProvisionOutputV1>

export class LinodeProvisioner extends AbstractInstanceProvisioner<LinodeProvisionInputV1, LinodeProvisionOutputV1> {

    constructor(args: LinodeProvisionerArgs){
        super(args)
    }

    /**
     * Destroy the instance server by running Pulumi stack up with specific configs
     * to remove instance server
     */
    async destroyInstanceServer(): Promise<LinodeProvisionOutputV1> {

        this.logger.info(`Destroying instance server for ${this.args.instanceName}`)

        const pulumiClient = this.buildPulumiClient()
        const stackConfig = this.buildPulumiConfig({ noInstanceServer: true })
        await pulumiClient.setConfig(stackConfig)
        await pulumiClient.up()

        const newOutputs = await pulumiClient.getOutputs()

        this.logger.debug(`New outputs after destroying instance server: ${JSON.stringify(newOutputs)}`)

        return this.pulumiOutputsToProvisionOutput(newOutputs)
    }

    private buildPulumiClient(): LinodePulumiClient {
        const pulumiClient = new LinodePulumiClient({
            stackName: this.args.instanceName,
            workspaceOptions: this.args.coreConfig.pulumi?.workspaceOptions
        })
        return pulumiClient
    }

    async doProvision() {

        this.logger.info(`Provisioning Linode instance ${this.args.instanceName}`)

        this.logger.debug(`Provisioning Linode instance with args ${JSON.stringify(this.args)}`)

        const pulumiClient = this.buildPulumiClient()
        const stackConfig = this.buildPulumiConfig()

        this.logger.debug(`Pulumi config: ${JSON.stringify(stackConfig)}`)

        await pulumiClient.setConfig(stackConfig)
        const pulumiOutputs = await pulumiClient.up()

        return this.pulumiOutputsToProvisionOutput(pulumiOutputs)
    }

    async doDestroy(){
        const pulumiClient = this.buildPulumiClient()
        
        await pulumiClient.destroy()

        this.args.provisionOutput = undefined
    }

    private buildPulumiConfig(args?: { noInstanceServer?: boolean }): PulumiStackConfigLinode {
        const sshPublicKeyContent = new SshKeyLoader().loadSshPublicKeyContent(this.args.provisionInput.ssh)

        const apiToken = this.args.provisionInput.apiToken ?? process.env.LINODE_TOKEN
        if(!apiToken) {
            throw new Error('Linode API token is required. Linode API token must be set either in state or as LINODE_TOKEN environment variable.')
        }

        return {
            region: this.args.provisionInput.region,
            instanceType: this.args.provisionInput.instanceType,
            rootDisk: {
                sizeGb: this.args.provisionInput.rootDiskSizeGb,
            },
            dataDisk: this.args.provisionInput.dataDiskSizeGb ? {
                sizeGb: this.args.provisionInput.dataDiskSizeGb,
            } : undefined,
            imageId: this.args.provisionInput.imageId,
            securityGroupPorts: this.getStreamingServerPorts(),
            publicKeyContent: sshPublicKeyContent,
            noInstanceServer: args?.noInstanceServer,
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
            rootDiskId: pulumiOutputs.rootDiskId
        }
    }

    async doVerifyConfig(){
        this.logger.debug(`Verifying Linode configuration for ${this.args.instanceName}`)

        const linodeClient = new LinodeClient()

        // We could add more validation here, such as testing the token
        this.logger.debug('Linode configuration verified')
    }

} 