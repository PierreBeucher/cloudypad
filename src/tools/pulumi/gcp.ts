import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { OutputMap } from "@pulumi/pulumi/automation"
import { InstancePulumiClient } from "./client"

interface PortDefinition {
    from: pulumi.Input<number>,
    to?: pulumi.Input<number>,
    protocol?: pulumi.Input<string>,
}

interface CloudyPadGCEInstanceArgs {
    ingressPorts: PortDefinition[]
    publicKeyContent: pulumi.Input<string>
    machineType: pulumi.Input<string>
    publicIpType: pulumi.Input<string>
    acceleratorType: pulumi.Input<string>
    bootDisk?: {
        sizeGb?: pulumi.Input<number>
    }
    useSpot?: pulumi.Input<boolean>
}

/**
 * Multiple replicas of CompositeGCEInstance
 */
class CloudyPadGCEInstance extends pulumi.ComponentResource {
    
    readonly instanceName: pulumi.Output<string>
    readonly publicIp: pulumi.Output<string>

    constructor(name: string, args: CloudyPadGCEInstanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:gcp:gce-instance", name, args, opts)

        const gcpResourceNamePrefix = `CloudyPad-${name}`.toLowerCase() // Most GCP resources must be lower case

        const commonPulumiOpts = {
            parent: this
        }

        const network = new gcp.compute.Network(`${name}-network`, {
            name: `${name}-network`.toLowerCase(),
            autoCreateSubnetworks: false,
        }, commonPulumiOpts);
        
        const subnet = new gcp.compute.Subnetwork(`${name}-subnetwork`, {
            name: `${name}-subnet`.toLowerCase(),
            network: network.id,
            ipCidrRange: "10.0.0.0/24",
        }, commonPulumiOpts);

        new gcp.compute.Firewall(`${name}-firewall`, {
            name: gcpResourceNamePrefix,
            network: network.id,
            allows: args.ingressPorts?.map(p => ({
                ports: [p.from.toString(), p.to?.toString() || p.from.toString()],
                protocol: p.protocol || "all",
            })),
            sourceRanges: ["0.0.0.0/0"],
            direction: "INGRESS",
        }, commonPulumiOpts)

        let publicIp: gcp.compute.Address | undefined = undefined
        if (args.publicIpType === "static") {
            publicIp = new gcp.compute.Address(`${name}-eip`, {
                name: gcpResourceNamePrefix,
            }, commonPulumiOpts)
        } else if (args.publicIpType !== "dynamic") {
            throw "publicIpType must be either 'static' or 'dynamic'"
        }

        const gceInstance = new gcp.compute.Instance(`${name}-gce-instance`, {
            name: gcpResourceNamePrefix,
            machineType: args.machineType,
            bootDisk: {
                initializeParams: {
                    image: "ubuntu-2204-lts",
                    size: args.bootDisk?.sizeGb || 50,
                    type: "pd-balanced"
                }
            },
            networkInterfaces: [{
                network: network.id,
                subnetwork: subnet.id,
                accessConfigs: [{ natIp: publicIp ? publicIp.address : undefined }],
            }],
            allowStoppingForUpdate: true,
            metadata: {
                "ssh-keys": `ubuntu:${args.publicKeyContent}`
            },
            guestAccelerators: [{
                type: args.acceleratorType,
                count: 1,
            }],
            scheduling: {
                automaticRestart: args.useSpot ? false : true, // Must be false for spot
                onHostMaintenance: "TERMINATE",
                provisioningModel: args.useSpot ? "SPOT" : "STANDARD",
                instanceTerminationAction: "STOP",
                preemptible: args.useSpot ?? false
            },
        }, commonPulumiOpts)

        this.instanceName = gceInstance.name

        this.publicIp = gceInstance.networkInterfaces.apply(ni => {
            if(ni.length != 1){
                throw new Error(`Expected a single network interface, got: ${JSON.stringify(ni)}`)
            }

            if(!ni[0].accessConfigs || ni[0].accessConfigs.length != 1) {
                throw new Error(`Expected a single network interface with an access config, got: ${JSON.stringify(ni)}`)
            }

            return ni[0].accessConfigs[0].natIp
        })
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function gcpPulumiProgram(): Promise<Record<string, any> | void> {

    const config = new pulumi.Config()
    const machineType = config.require("machineType")
    const acceleratorType = config.require("acceleratorType")
    const bootDiskSizeGB = config.requireNumber("bootDiskSizeGB")
    const publicIpType = config.require("publicIpType")
    const publicKeyContent = config.require("publicSshKeyContent")
    const useSpot = config.requireBoolean("useSpot")

    const instanceName = pulumi.getStack()

    const instance = new CloudyPadGCEInstance(instanceName, {
        machineType: machineType,
        acceleratorType: acceleratorType, 
        publicKeyContent: publicKeyContent,
        bootDisk: {
            sizeGb: bootDiskSizeGB
        },
        publicIpType: publicIpType,
        ingressPorts: [ 
            { from: 22, protocol: "tcp" }, 
            { from: 47984, protocol: "tcp" }, 
            { from: 47989, protocol: "tcp" }, 
            { from: 48010, protocol: "tcp" }, 
            { from: 47999, protocol: "udp" }, 
            { from: 48100, to: 48110, protocol: "udp" }, 
            { from: 48200, to: 48210, protocol: "udp" }, 
        ],
        useSpot: useSpot,
    })

    return {
        instanceName: instance.instanceName,
        publicIp: instance.publicIp
    }

}

export interface PulumiStackConfigGcp {
    projectId: string
    region: string
    zone: string
    machineType: string
    acceleratorType: string
    rootDiskSize: number
    publicSshKeyContent: string
    publicIpType: string
    useSpot: boolean
}

export interface GcpPulumiOutput {
    instanceName: string
    publicIp: string
}

export class GcpPulumiClient extends InstancePulumiClient<PulumiStackConfigGcp, GcpPulumiOutput> {

    constructor(stackName: string){
        super({ program: gcpPulumiProgram, projectName: "CloudyPad-GCP", stackName: stackName})
    }

    async setConfig(config: PulumiStackConfigGcp){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("gcp:region", { value: config.region })
        await stack.setConfig("gcp:zone", { value: config.zone })
        await stack.setConfig("gcp:project", { value: config.projectId })

        await stack.setConfig("machineType", { value: config.machineType })
        await stack.setConfig("acceleratorType", { value: config.acceleratorType })
        await stack.setConfig("bootDiskSizeGB", { value: config.rootDiskSize.toString() })
        await stack.setConfig("publicSshKeyContent", { value: config.publicSshKeyContent })
        await stack.setConfig("publicIpType", { value: config.publicIpType })
        await stack.setConfig("useSpot", { value: config.useSpot.toString() })

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Config after update: ${JSON.stringify(allConfs)}`)

    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<GcpPulumiOutput>{
        return {
            instanceName: outputs["instanceName"].value as string,
            publicIp: outputs["publicIp"].value as string
        }
    }
}
