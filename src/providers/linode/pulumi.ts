import * as pulumi from "@pulumi/pulumi"
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
}

class CloudyPadLinodeInstance extends pulumi.ComponentResource {
    
    public readonly publicIp: pulumi.Output<string | undefined>
    public readonly instanceServerName: pulumi.Output<string | undefined>
    public readonly instanceServerId: pulumi.Output<string | undefined>
    public readonly instanceServerURN: pulumi.Output<string | undefined>

    public readonly dataDiskId: pulumi.Output<string>
    
    constructor(name: string, args: LinodeInstanceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:linode:instance", name, {}, opts)

        let instanceServer: linode.Instance | undefined
        if(args.noInstanceServer) {
            this.instanceServerName = pulumi.output(undefined)
            this.instanceServerId = pulumi.output(undefined)
            this.publicIp = pulumi.output(undefined)
            this.instanceServerURN = pulumi.output(undefined)
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
            }, { 
                parent: this,
            })

            this.instanceServerName = instanceServer.label
            this.instanceServerId = instanceServer.id
            this.publicIp = instanceServer.ipv4s[0]
            this.instanceServerURN = instanceServer.urn
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
        noInstanceServer: noInstanceServer
    })

    return pulumi.all([
        instance.instanceServerName, 
        instance.publicIp, 
        instance.instanceServerId, 
        instance.dataDiskId, 
        instance.instanceServerURN
    ]).apply(([instanceServerName, publicIp, instanceServerId, dataDiskId, instanceServerUrn]) => {
        const result: LinodePulumiOutput = {
            instanceServerName: instanceServerName,
            publicIp: publicIp,
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
    publicIp?: string

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

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Linode stack config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<LinodePulumiOutput>{
        return {
            instanceServerName: outputs["instanceServerName"]?.value as string | undefined,
            publicIp: outputs["publicIp"].value as string | undefined,
            instanceServerId: outputs["instanceServerId"]?.value as string | undefined,
            instanceServerUrn: outputs["instanceServerUrn"]?.value as string | undefined,
            dataDiskId: outputs["dataDiskId"].value as string
        }   
    }
} 