import * as scw from "@pulumiverse/scaleway"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../tools/pulumi/client"
import { OutputMap } from "@pulumi/pulumi/automation"
import { SimplePortDefinition } from "../../core/const"

interface ScalewayInstanceArgs {
    networkSecurityGroupRules?: pulumi.Input<pulumi.Input<scw.types.input.InstanceSecurityGroupInboundRule>[]>
    publicKeyContent: pulumi.Input<string>
    tags?: pulumi.Input<string[]>
    instanceType: pulumi.Input<string>
    imageId?: pulumi.Input<string>
    rootVolume: {
        sizeGb: pulumi.Input<number>
    },
    additionalVolumes: {
        sizeGb: pulumi.Input<number>
        name: pulumi.Input<string>
    }[]
}

class CloudyPadScalewayInstance extends pulumi.ComponentResource {
    public readonly publicIp: pulumi.Output<string | undefined>
    public readonly instanceName: pulumi.Output<string>
    public readonly instanceServerId: pulumi.Output<string>
    constructor(name: string, args: ScalewayInstanceArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:scaleway:vm", name, args, opts)

        const globalTags = [
            name
        ]

        const commonPulumiOpts = {
            parent: this
        }

        const sshKey = new scw.iam.SshKey(`${name}-ssh-key`, {
            name: `${name}-ssh-key`,
            publicKey: args.publicKeyContent,
        }, commonPulumiOpts)

        const vpc = new scw.network.Vpc(`${name}-vpc`, {
            name: `cloudypad-${name}-vpc`,
            tags: globalTags
        }, commonPulumiOpts)

        const securityGroup = new scw.instance.SecurityGroup(`${name}-security-group`, {
            name: `${name}-sg`,
            inboundRules: args.networkSecurityGroupRules,
            outboundDefaultPolicy: "accept",
            tags: globalTags,
        }, commonPulumiOpts)

        const publicIp = new scw.instance.Ip(`${name}-public-ip`, {
            tags: globalTags
        }, commonPulumiOpts)

        const volumes = args.additionalVolumes?.map((v) => new scw.block.Volume(`${name}-${v.name}`, {
                name: v.name,
                sizeInGb: v.sizeGb,
                iops: 5000,
                tags: globalTags
            }, commonPulumiOpts)
        ) ?? []

        const server = new scw.instance.Server(`${name}-server`, {
            name: name,
            type: args.instanceType,
            rootVolume: {
                sizeInGb: args.rootVolume.sizeGb,
                volumeType: "sbs_volume",
            },
            additionalVolumeIds: volumes.map((v) => v.id),
            tags: globalTags,
            securityGroupId: securityGroup.id,
            image: args.imageId ?? "ubuntu_jammy_gpu_os_12",
            ipIds: [publicIp.id],
        }, {
            ...commonPulumiOpts,
            ignoreChanges: ["rootVolume.volumeType"] // avoid recreation of existing instances using legacy block volume type
        })

        this.instanceName = server.name
        // server id looks like this: "fr-par-2/4becedc8-51e9-4320-a45c-20f0f57033fa"
        // we want to extract only the I
        this.instanceServerId = server.id.apply(id => id.split("/").pop() as string)
        this.publicIp = publicIp.address

    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function scalewayPulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const instanceType = config.require("instanceType")
    const publicKeyContent = config.require("publicKeyContent")
    const rootDiskSizeGB = config.requireNumber("rootDiskSizeGB")
    const securityGroupPorts = config.requireObject<SimplePortDefinition[]>("securityGroupPorts")
    const additionalVolumes = config.requireObject<ScalewayInstanceArgs["additionalVolumes"]>("additionalVolumes")
    const imageId = config.get("imageId")

    const instanceName = pulumi.getStack()

    const instance = new CloudyPadScalewayInstance(instanceName, {
        instanceType: instanceType,
        publicKeyContent: publicKeyContent,
        networkSecurityGroupRules: securityGroupPorts.map(p => ({
            action: "accept",
            ipRange: "0.0.0.0/0",
            protocol: p.protocol,
            port: p.port,
        })),
        rootVolume: {
            sizeGb: rootDiskSizeGB,
        },
        additionalVolumes: additionalVolumes,
        imageId: imageId
    })

    return {
        instanceName: instance.instanceName,
        publicIp: instance.publicIp,
        instanceServerId: instance.instanceServerId,
    }
}

export interface PulumiStackConfigScaleway {
    projectId: string
    region: string
    zone: string
    instanceType: string
    imageId?: string
    rootDisk: {
        sizeGb: number
    }
    publicKeyContent: string
    securityGroupPorts: SimplePortDefinition[]
    additionalVolumes: {
        sizeGb: number
        name: string
    }[],
}


export interface ScalewayPulumiOutput {
    instanceName: string
    instanceServerId: string
    publicIp: string
}

export class ScalewayPulumiClient extends InstancePulumiClient<PulumiStackConfigScaleway, ScalewayPulumiOutput> {

    constructor(stackName: string){
        super({ program: scalewayPulumiProgram, projectName: "CloudyPad-Scaleway", stackName: stackName})
    }

    async doSetConfig(config: PulumiStackConfigScaleway){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("scaleway:project_id", { value: config.projectId})
        await stack.setConfig("scaleway:region", { value: config.region})
        await stack.setConfig("scaleway:zone", { value: config.zone})
        
        await stack.setConfig("instanceType", { value: config.instanceType})
        if(config.imageId) await stack.setConfig("imageId", { value: config.imageId})
        await stack.setConfig("additionalVolumes", { value: JSON.stringify(config.additionalVolumes ?? [])})

        await stack.setConfig("rootDiskSizeGB", { value: config.rootDisk.sizeGb.toString()})
        await stack.setConfig("publicKeyContent", { value: config.publicKeyContent})
        await stack.setConfig("securityGroupPorts", { value: JSON.stringify(config.securityGroupPorts.map(p => ({
            protocol: p.protocol.toUpperCase(), // Scaleway SDK requires "TCP" or "UDP" in upper!case
            port: p.port
        })))})

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Scaleway stack config after update: ${JSON.stringify(allConfs)}`)

    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<ScalewayPulumiOutput>{
        return {
            instanceName: outputs["instanceName"].value as string,
            publicIp: outputs["publicIp"].value as string,
            instanceServerId: outputs["instanceServerId"].value as string
        }   
    }

}