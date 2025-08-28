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
        record?: string
    }
}

class CloudyPadLinodeInstance extends pulumi.ComponentResource {
    
    public readonly publicIp: pulumi.Output<string | undefined>
    public readonly instanceServerName: pulumi.Output<string | undefined>
    public readonly instanceServerId: pulumi.Output<string | undefined>
    public readonly instanceServerURN: pulumi.Output<string | undefined>
    public readonly instanceHostname: pulumi.Output<string | undefined>

    public readonly dataDiskId: pulumi.Output<string>
    
    constructor(name: string, args: LinodeInstanceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:linode:instance", name, {}, opts)

        let instanceServer: linode.Instance | undefined
        if(args.noInstanceServer) {
            this.instanceServerName = pulumi.output(undefined)
            this.instanceServerId = pulumi.output(undefined)
            this.publicIp = pulumi.output(undefined)
            this.instanceServerURN = pulumi.output(undefined)
            this.instanceHostname = pulumi.output(undefined)
        } else {

            instanceServer = new linode.Instance(`${name}-instance`, {
                label: `${name}-server`,
                image: args.imageId || "linode/ubuntu22.04",
                region: args.region,
                type: args.instanceType,
                authorizedKeys: args.authorizedKeys,
                diskEncryption: "enabled",
                // rootPass: pulumi.secret(args.rootPassword),
                privateIp: true,
                booted: true,
                // watchdog would start instance if stopped "unexpectedly"
                // which would cause instance to restart after being stopped by auto-stop service for idleness
                watchdogEnabled: false
            }, { 
                parent: this,
            })

            const instanceServerIp = instanceServer.ipv4s[0]

            this.instanceServerName = instanceServer.label
            this.instanceServerId = instanceServer.id
            this.publicIp = instanceServer.ipv4s[0]
            this.instanceServerURN = instanceServer.urn

            // create DNS A record if provided and use as instance hostname
            // otherwise use IP address as instance hostname
            if (args.dns) {

                // generate a random record name desired record name is not provided
                let recordNameSuffix = args.dns.record ? 
                    pulumi.output(args.dns.record)
                : 
                    new random.RandomString("record-name", {
                        length: 20,
                        lower: true,
                        special: false,
                        upper: false,
                        numeric: false,
                    }).result

                const recordName = pulumi.interpolate`${name}-${recordNameSuffix}`

                // fetch defined domain and create DNS record
                const dnsRecord = linode.getDomainOutput({ domain: args.dns.domainName }).apply(domain => {

                    if(!domain.id) {
                        throw new Error(`Domain for '${args.dns?.domainName}' not found`)
                    }

                    return new linode.DomainRecord(`${name}-dns-record`, {
                        domainId: domain.id,
                        name: recordName,
                        recordType: "A",
                        target: instanceServerIp,
                        ttlSec: 30,
                    }, {
                        parent: this,
                    })
                })

                // FQDN like my-instance.my-domain.cloudypad.gg
                this.instanceHostname = pulumi.interpolate`${dnsRecord.name}.${args.dns.domainName}`
            } else {
                this.instanceHostname = instanceServerIp
            }
        }

        const dataVolume = new linode.Volume(`${name}-data-disk`, {
            label: ShaUtils.createUniqueNameWith({ baseName: name, maxLength: LINODE_LABEL_MAX_LENGTH, suffix: "-data" }),
            size: args.dataVolume.sizeGb,
            region: args.region,
            linodeId: instanceServer ? instanceServer.id.apply((id: string) => Number.parseInt(id)) : undefined,
        }, { parent: this })

        this.dataDiskId = dataVolume.filesystemPath.apply(p => path.basename(p))
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
        dns: dns
    })

    return pulumi.all([
        instance.instanceServerName, 
        instance.instanceHostname, 
        instance.instanceServerId, 
        instance.dataDiskId, 
        instance.instanceServerURN
    ]).apply(([instanceServerName, instanceHostname, instanceServerId, dataDiskId, instanceServerUrn]) => {
        const result: LinodePulumiOutput = {
            instanceServerName: instanceServerName,
            instanceHostname: instanceHostname,
            instanceServerId: instanceServerId,
            dataDiskId: dataDiskId,
            instanceServerUrn: instanceServerUrn
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
     * Pulumi URN of the root OS disk
     */
    instanceServerUrn?: string

    /**
     * ID of the data disk
     */
    dataDiskId: string
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
            instanceHostname: outputs["instanceHostname"].value as string | undefined,
            instanceServerId: outputs["instanceServerId"]?.value as string | undefined,
            instanceServerUrn: outputs["instanceServerUrn"]?.value as string | undefined,
            dataDiskId: outputs["dataDiskId"].value as string
        }   
    }
} 