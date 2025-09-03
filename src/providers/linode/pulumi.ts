import * as pulumi from "@pulumi/pulumi"
import * as random from "@pulumi/random"
import * as linode from "@pulumi/linode"
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation"
import { InstancePulumiClient } from "../../tools/pulumi/client"
import { SimplePortDefinition } from "../../core/const"
import { ShaUtils } from "../../tools/sha-utils"
import * as path from "path"

/**
 * Maximum length of a label for a Linode instance or volume.
 */
export const LINODE_LABEL_MAX_LENGTH = 32

interface LinodeInstanceArgs {
    instanceType: string
    region: string

    /**
     * Authorized SSH public keys to be added to the instance.
     */
    authorizedKeys: string[]

    /**
     * Network security group ports to be opened on the instance.
     */
    networkSecurityGroupPorts: SimplePortDefinition[]

    /**
     * Size of the root disk in GB.
     */
    rootVolume: {
        sizeGb: number
    }

    /**
     * Size of the data disk in GB.
     */
    dataVolume: {
        sizeGb: number
    }

    /**
     * Base image ID to use for the instance.
     * If not specified, a suitable default image will be used.
     */
    imageId?: string

    /**
     * If true, the instance server will not be created and remove if it exists.
     * Data disk is persisted.
     */
    noInstanceServer?: boolean

    /**
     * Enable or disable Linode Watchdog. When enabled, automatically restarts instance on shutdown.
     * Should be true during configuration and false during normal usage.
     */
    watchdogEnabled?: boolean

    /**
     * Optional DNS configuration to create an A record pointing to the instance's public IP.
     * If provided, will create a DNS A record and return the FQDN as hostname.
     * If not provided, will return the plain IP address as hostname.
     */
    dns?: {

        /**
         * Domain under which to create the DNS record.
         * Linode accept domain ID as number. Passing a string is also possible
         * but it must be a valid domain ID.
         */
        domainName: string

        /**
         * Custom A DNS record name to use. If not specified, a random record name is generated
         * Make sure to pass a valid, short record name. 
         */
        record?: string
    }
}

/**
 * Pulumi component resource for a Linode instance with server, volume and optional DNS record.
 * 
 * The DNS record is optional and if not provided, the instance hostname is the instance IP.
 * 
 * If set, DNS record will always exists on instance so as to remain static and unchanged across updated
 * to prevent recreation (and change) of RandomString used to define record name.
 * 
 * As it's not possible (yet at the time of implementation) to provision static IP address with Linode,
 * using DNS record allows to keep instance hostname static across reboot and instance server recreation
 * so that Moonlight pairing remains valid. 
 */
class CloudyPadLinodeInstance extends pulumi.ComponentResource {
    
    public readonly publicIp: pulumi.Output<string>
    public readonly instanceServerName: pulumi.Output<string | undefined>
    public readonly instanceServerId: pulumi.Output<string | undefined>
    public readonly instanceServerURN: pulumi.Output<string | undefined>
    public readonly instanceHostname: pulumi.Output<string | undefined>

    public readonly rootDiskId: pulumi.Output<string | undefined>
    public readonly dataDiskId: pulumi.Output<string>
    
    constructor(name: string, args: LinodeInstanceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:linode:instance", name, {}, opts)

        let instanceServer: linode.Instance | undefined
        let desiredInstanceConfig: pulumi.Output<linode.InstanceConfig> | undefined

        // label affacted to data disk volume
        // set early as it's required on instance creation/update to discrimiate with root disk
        const dataDiskLabel = this.linodeLabel(name, "-vol")

        if(args.noInstanceServer) {
            this.instanceServerName = pulumi.output(undefined)
            this.instanceServerId = pulumi.output(undefined)

            // use dummy IP 192.0.2.1 as public IP when instance server disabled
            // this ensure DNS record keeps existing with short TTL
            // 192.0.2.1 is in TEST-NET-1 and should not be routed
            this.publicIp = pulumi.output("192.0.2.1")

            this.instanceServerURN = pulumi.output(undefined)
            this.instanceHostname = pulumi.output(undefined)
            this.rootDiskId = pulumi.output(undefined)
        } else {

            const intanceConfigLabel = `${name}-custom-config`

            instanceServer = new linode.Instance(`${name}-instance`, {
                label: this.linodeLabel(name, "-server"),
                image: args.imageId || "linode/ubuntu22.04",
                region: args.region,
                type: args.instanceType,
                authorizedKeys: args.authorizedKeys,
                diskEncryption: "enabled",
                privateIp: true,
                booted: false, // don't boot instance here as config will be applied later
                // Linode Watchdog restart instance regardless of using a 'reboot' or 'shutdown'
                // Set it to false by default. On initial instance config this must be set to true
                // as instance is expected to reboot during configuration
                // but should be false during normal usage to avoid instance being rebooted if stopped by auto-stop after idleness
                watchdogEnabled: args.watchdogEnabled ?? false,
            }, { 
                parent: this,
                ignoreChanges: ["booted"], // ignored booted changes as it will always be booted with InstanceConfig
            })

            // ID is outputted as string but Pulumi Linode interface requires it as number
            const instanceServerIdInt = instanceServer.id.apply((id: string) => Number(id))

            // fetch the default instance config set on provision from which we'll create custom config
            // we don't want this configuration but a custom configuration (see comments on InstanceConfig below)
            const defaultInstanceConfig = instanceServer.configs.apply(configs => {
                pulumi.log.info(`Instance server configs: ${JSON.stringify(configs)}`)

                const defaultConfig = configs.find(config => config.label !== intanceConfigLabel)

                if(!defaultConfig) {
                    throw new Error(`Default config not found for instance server ${name}`)
                }

                return linode.InstanceConfig.get(`${name}-instance-config`, defaultConfig.id.toString(), {
                    linodeId: instanceServerIdInt
                })
            })


            defaultInstanceConfig.kernel?.apply((kernel: string | undefined) => {
                pulumi.log.info(`Current instance config kernel: ${kernel}`)
            })

            desiredInstanceConfig = pulumi.all([
                defaultInstanceConfig.device,
                defaultInstanceConfig.helpers,
                defaultInstanceConfig.interfaces,
                defaultInstanceConfig.memoryLimit,
                defaultInstanceConfig.runLevel,
                defaultInstanceConfig.virtMode,
                defaultInstanceConfig.rootDevice,
            ]).apply(([device, helpers, interfaces, memoryLimit, runLevel, virtMode, rootDevice]) => {

                // Force use grub2 to ensure base image is used with NVIDIA drivers
                // Clone other configs from default instanceConfig
                // Default instance config prevents NVIDIA driver configured on base image to work                
                // See https://www.linode.com/community/questions/24188/is-it-possible-to-create-an-image-that-has-the-nvidia-driver-pre-installed
                return new linode.InstanceConfig(`${name}-instance-config`, {
                    linodeId: instanceServerIdInt,
                    label: this.linodeLabel(name, "-config"),
                    kernel: "linode/grub2", 
                    booted: true,
                    device: device,
                    helpers: helpers,
                    interfaces: interfaces,
                    memoryLimit: memoryLimit,
                    rootDevice: rootDevice,
                    runLevel: runLevel,
                    virtMode: virtMode
                }, {
                    parent: this,
                })
            })

            // fetch root disk ID
            // can't rely on instance.disks as it's deprecated and buggy (sometime an Object like 
            // { xxx: xxx, value: linode.types.output.InstanceDisk[] } 
            // is returned rather than linode.types.output.InstanceDisk[])
            const linodeFetchResult = linode.getInstancesOutput({ 
                filters: [{ "name": "id", "values": [instanceServer.id] }]
            })

            const rootDiskId = linodeFetchResult.instances.apply(instances => {
                pulumi.log.info(`Linode fetch result: ${JSON.stringify(instances)}`)

                if(instances.length !== 1) {
                    throw new Error(`Expected 1 instance server, got ${instances.length}: ${JSON.stringify(instances)}`)
                }

                const instance = instances[0]

                // not perfect way to find the default disk attached to instance
                // root disk should be ext4 and NOT the data disk (as per label)
                const rootDisk = instance.disks.find(disk => disk.filesystem === "ext4" && !disk.label.includes(dataDiskLabel))

                if(!rootDisk) {
                    throw new Error(`Root disk not found for instance server ${name}. Got disks: ${JSON.stringify(instance.disks)}`)
                }

                pulumi.log.info(`Found root disk: ${JSON.stringify(rootDisk)}`)

                return rootDisk.id.toString()
            })

            this.rootDiskId = rootDiskId
            this.instanceServerName = instanceServer.label
            this.instanceServerId = instanceServer.id
            this.publicIp = instanceServer.ipv4s[0]
            this.instanceServerURN = instanceServer.urn
        }

        // create DNS record if provided and use as instance hostname
        // If not DNS record is provided, use instance IP as hostname
        //
        // If configured, DNS record always exists for instance even if instance server does not exist
        // in the case of non-existing server, it points to a "null" address
        if (args.dns) {

            let recordName: pulumi.Input<string>

            // if no specific DNS record is provided, generate a random record name
            if(args.dns.record) {
                recordName = args.dns.record
            } else {
                const recordNameBase = this.linodeLabel(name)

                // generate a random record name desired record name is not provided
                let recordNameSuffix = new random.RandomString("record-name", {
                    length: 20,
                    lower: true,
                    special: false,
                    upper: false,
                    numeric: false,
                }).result

                recordName = pulumi.interpolate`${recordNameBase}-${recordNameSuffix}`
            } 

            // fetch defined domain and create DNS record
            // Create a short DNS record to avoid too-long record error
            const dnsRecord = linode.getDomainOutput({ domain: args.dns.domainName }).apply(domain => {

                if(!domain.id) {
                    throw new Error(`Domain for '${args.dns?.domainName}' not found`)
                }

                pulumi.output(recordName).apply(r => pulumi.log.info(`DNS record: ${r}`))
                
                return new linode.DomainRecord(`${name}-dns-record`, {
                    domainId: domain.id,
                    name: recordName,
                    recordType: "A",
                    target: this.publicIp,
                    ttlSec: 30, // voluntary short TTL as instance IP will change each boot
                }, {
                    parent: this,
                })
            })

            // FQDN like my-instance.my-domain.cloudypad.gg
            this.instanceHostname = pulumi.interpolate`${dnsRecord.name}.${args.dns.domainName}`
        } else {
            // use server IP as hostname if no DNS record is provided
            this.instanceHostname = this.publicIp
        }

        const dataVolume = new linode.Volume(`${name}-data-disk`, {
            label: this.linodeLabel(name, "-vol"),
            size: args.dataVolume.sizeGb,
            region: args.region,
            linodeId: instanceServer ? instanceServer.id.apply((id: string) => Number(id)) : undefined,
        }, { 
            parent: this,
            dependsOn: desiredInstanceConfig ? [desiredInstanceConfig] : undefined
        })

        const firewall = new linode.Firewall(`${name}-firewall`, {
            label: this.linodeLabel(name, "-fw"),
            inbounds: args.networkSecurityGroupPorts.map(port => ({
                label: `allow-${port.protocol.toLowerCase()}-${port.port}`,
                action: "ACCEPT",
                protocol: port.protocol.toUpperCase(),
                ports: port.port.toString(),
                ipv4s: ["0.0.0.0/0"],
                ipv6s: ["::/0"],
            })),
            inboundPolicy: "DROP",
            outboundPolicy: "ACCEPT",
            linodes: instanceServer ? [instanceServer.id.apply((id: string) => Number(id))] : [],
        }, { 
            parent: this,
        })

        // path is like /dev/disk/by-id/scsi-0Linode_Volume_my-instance-vol
        // we want to extract the volume name
        this.dataDiskId = dataVolume.filesystemPath.apply(p => path.basename(p))
    }

    /**
     * Create a valid Linode label (no more than LINODE_LABEL_MAX_LENGTH length)
     * @param name desired label name, trimmed with hash if too long
     * @param suffix desired suffix, always appear
     */
    private linodeLabel(name: string, suffix?: string){
        return ShaUtils.createUniqueNameWith({ 
            baseName: name, 
            maxLength: LINODE_LABEL_MAX_LENGTH, 
            suffix: suffix
        })
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function linodePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const instanceType = config.require("instanceType")
    const region = config.require("region")
    const authorizedKeys = config.requireObject<string[]>("authorizedKeys")
    const rootDiskSizeGB = config.requireNumber("rootDiskSizeGB")
    const securityGroupPorts = config.requireObject<SimplePortDefinition[]>("securityGroupPorts")
    const dataDisk = config.requireObject<LinodeInstanceArgs["dataVolume"]>("dataDisk")
    const imageId = config.get("imageId")
    const noInstanceServer = config.getBoolean("noInstanceServer")
    const watchdogEnabled = config.getBoolean("watchdogEnabled")
    const dns = config.getObject<LinodeInstanceArgs["dns"]>("dns")

    const stackName = pulumi.getStack()

    const instance = new CloudyPadLinodeInstance(stackName, {
        instanceType: instanceType,
        region: region,
        authorizedKeys: authorizedKeys,
        networkSecurityGroupPorts: securityGroupPorts,
        rootVolume: {
            sizeGb: rootDiskSizeGB,
        },
        dataVolume: dataDisk,
        imageId: imageId,
        noInstanceServer: noInstanceServer,
        watchdogEnabled: watchdogEnabled,
        dns: dns
    })

    return pulumi.all([
        instance.instanceServerName, 
        instance.instanceHostname, 
        instance.instanceServerId, 
        instance.dataDiskId, 
        instance.instanceServerURN,
        instance.publicIp,
        instance.rootDiskId
    ]).apply(([instanceServerName, instanceHostname, instanceServerId, dataDiskId, instanceServerUrn, publicIp, rootDiskId]) => {
        const result: LinodePulumiOutput = {
            instanceServerName: instanceServerName,
            instanceHostname: instanceHostname,
            instanceIPv4: publicIp,
            instanceServerId: instanceServerId,
            dataDiskId: dataDiskId,
            instanceServerUrn: instanceServerUrn,
            rootDiskId: rootDiskId
        }
        return result
    })
}

export interface PulumiStackConfigLinode {
    region: string
    instanceType: string
    apiToken: string
    noInstanceServer?: boolean
    imageId?: string
    rootDisk: {
        sizeGb: number
    }
    publicKeyContent: string
    securityGroupPorts: SimplePortDefinition[]
    dataDisk?: {
        sizeGb: number
    }
    watchdogEnabled?: boolean
    dns?: {
        domainName: string
        record?: string
    }
}

/**
 * Output of the Pulumi program for the Linode provider.
 * Use null rather than undefined for fields that may not be set as otherwise Pulumi shows warnings about undefined outputs.
 * Explicitly set null as we want to show that these fields are empty voluntarily.
 */
export interface LinodePulumiOutput {
    instanceServerName?: string

    /**
     * ID of the instance server
     */
    instanceServerId?: string

    /**
     * Public IP address of the instance
     */
    instanceHostname?: string

    /**
     * Public IPv4 address of the instance
     */
    instanceIPv4: string

    /**
     * Pulumi URN of the root OS disk
     */
    instanceServerUrn?: string

    /**
     * ID of the data disk
     */
    dataDiskId: string

    /**
     * ID of instance root disk
     */
    rootDiskId?: string
}

export interface LinodePulumiClientArgs {
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}

export class LinodePulumiClient extends InstancePulumiClient<PulumiStackConfigLinode, LinodePulumiOutput> {

    constructor(args: LinodePulumiClientArgs){
        super({ 
            program: linodePulumiProgram, 
            projectName: "CloudyPad-Linode", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigLinode){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        
        // Set Linode provider configuration
        await stack.setConfig("linode:token", { value: config.apiToken, secret: true })
        await stack.setConfig("region", { value: config.region })
        
        if(config.noInstanceServer) await stack.setConfig("noInstanceServer", { value: config.noInstanceServer.toString()})
        await stack.setConfig("instanceType", { value: config.instanceType})

        if(config.imageId) await stack.setConfig("imageId", { value: config.imageId})
        if(config.dataDisk) await stack.setConfig("dataDisk", { value: JSON.stringify(config.dataDisk)})
        if(config.watchdogEnabled !== undefined) await stack.setConfig("watchdogEnabled", { value: config.watchdogEnabled.toString()})

        await stack.setConfig("rootDiskSizeGB", { value: config.rootDisk.sizeGb.toString()})
        await stack.setConfig("authorizedKeys", { value: JSON.stringify([config.publicKeyContent])})
        await stack.setConfig("securityGroupPorts", { value: JSON.stringify(config.securityGroupPorts)})

        if(config.dns) await stack.setConfig("dns", { value: JSON.stringify(config.dns)})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Linode stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<LinodePulumiOutput>{
        return {
            instanceServerName: outputs["instanceServerName"]?.value as string | undefined,
            instanceIPv4: outputs["instanceIPv4"].value as string,
            instanceHostname: outputs["instanceHostname"].value as string | undefined,
            instanceServerId: outputs["instanceServerId"]?.value as string | undefined,
            instanceServerUrn: outputs["instanceServerUrn"]?.value as string | undefined,
            dataDiskId: outputs["dataDiskId"].value as string,
            rootDiskId: outputs["rootDiskId"]?.value as string | undefined
        }   
    }
} 