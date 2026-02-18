import { DEFAULT_DISK_TYPE, NETWORK_TIER_STANDARD, NIC_TYPE_AUTO } from "../const";
import * as gcp from "@pulumi/gcp"
import * as pulumi from "@pulumi/pulumi"
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC, SimplePortDefinition } from "../../../core/const"
import { CostAlertOptions } from "../../../core/provisioner"

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
        type?: pulumi.Input<string>
    }
    imageId?: pulumi.Input<string>
    instanceServerState?: "present" | "absent"
    dataDisk?: {
        /**
         * Desired state of the data disk.
         */
        state: "present" | "absent"

        /**
         * Size of the data disk in GB.
         */
        sizeGb: pulumi.Input<number>

        /**
         * If set, create the data disk from this snapshot instead of creating a new empty disk.
         * Used when restoring from a snapshot on instance start.
         */
        snapshotId?: pulumi.Input<string>
    }
    networkTier?: pulumi.Input<string>
    nicType?: pulumi.Input<string>
    useSpot?: pulumi.Input<boolean>
    projectId: pulumi.Input<string>
    costAlert?: {
        limit: pulumi.Input<number>
        notificationEmail: pulumi.Input<string>
    }
    firewallAllowPorts: pulumi.Input<pulumi.Input<gcp.types.input.compute.FirewallAllow>[]> 
}

/**
 * Multiple replicas of CompositeGCEInstance
 */
class CloudyPadGCEInstance extends pulumi.ComponentResource {
    
    readonly instanceName: pulumi.Output<string>
    readonly publicIp: pulumi.Output<string>
    readonly dataDiskId: pulumi.Output<string | null>
    readonly rootDiskId: pulumi.Output<string | null>

    constructor(name: string, args: CloudyPadGCEInstanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:gcp:gce-instance", name, args, opts)

        const gcpResourceNamePrefix = `CloudyPad-${name}`.toLowerCase() // Most GCP resources must be lower case

        const commonPulumiOpts = {
            parent: this
        }

        const effectiveNetworkTier: pulumi.Output<string> = pulumi
            .output(args.networkTier)
            .apply((t) => t ?? NETWORK_TIER_STANDARD);

        const enableTier1 = pulumi
            .all([args.machineType, args.nicType])
            .apply(([mt, nic]) => supportsTier1(mt, nic) ? { totalEgressBandwidthTier: "TIER_1" } : undefined);

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
            allows: args.firewallAllowPorts,
            sourceRanges: ["0.0.0.0/0"],
            direction: "INGRESS",
        }, commonPulumiOpts)

        let publicIp: gcp.compute.Address | undefined = undefined
        if (args.publicIpType === PUBLIC_IP_TYPE_STATIC) {
            publicIp = new gcp.compute.Address(`${name}-eip`, {
                name: gcpResourceNamePrefix,
                networkTier: effectiveNetworkTier,
            }, commonPulumiOpts)
        } else if (args.publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
            throw `publicIpType must be either '${PUBLIC_IP_TYPE_STATIC}' or '${PUBLIC_IP_TYPE_DYNAMIC}'`
        }

        // Create data disk if requested and not explicitly set to absent
        let dataDisk: gcp.compute.Disk | undefined
        if(args.dataDisk && args.dataDisk.state !== "absent"){
            // If snapshotId is provided, create disk from snapshot
            // Otherwise create a new empty disk
            dataDisk = new gcp.compute.Disk(`${name}-data`, {
                name: `${gcpResourceNamePrefix}-data`,
                size: args.dataDisk.sizeGb,
                type: args.bootDisk?.type ?? DEFAULT_DISK_TYPE,
                snapshot: args.dataDisk.snapshotId,
            }, commonPulumiOpts)

            dataDisk?.id.apply(id => {
                pulumi.log.info(`Data disk: ${id}`)
            })
            // Return the disk name which will be used as the device name for mounting
            // In GCP, this appears as /dev/disk/by-id/google-{name} or by the persistent disk name
            this.dataDiskId = dataDisk.name
        } else {
            this.dataDiskId = pulumi.output(null)
        }
        
        // Build instance with strict typing, conditionally add networkPerformanceConfig inline based on enableTier1
        // always create server unless specifically set to absent
        if(args.instanceServerState !== "absent"){
            const gceInstance = enableTier1.apply(enableTier1Result => {
                // Attach data disk if present
                // The device name should match the disk name for consistency
                // In GCP, attached disks appear as /dev/disk/by-id/google-{persistentDiskName}
                const attachedDisks: pulumi.Input<pulumi.Input<gcp.types.input.compute.InstanceAttachedDisk>[]> = dataDisk 
                    ? [{
                        source: dataDisk.selfLink,
                        // Use the disk name as device name so it's consistent with how we reference it
                        deviceName: dataDisk.name,
                    }]
                    : [];

                const instanceArgs: gcp.compute.InstanceArgs = {
                    name: gcpResourceNamePrefix,
                    machineType: args.machineType,
                    bootDisk: {
                        initializeParams: {
                            image: args.imageId ?? "ubuntu-2204-jammy-v20241119",
                            size: args.bootDisk?.sizeGb || 50,
                            type: args.bootDisk?.type ?? DEFAULT_DISK_TYPE
                        }
                    },
                    attachedDisks: attachedDisks,
                    networkInterfaces: [{
                        network: network.id,
                        subnetwork: subnet.id,
                        nicType: args.nicType && args.nicType !== NIC_TYPE_AUTO ? args.nicType : undefined,
                        accessConfigs: [{ 
                            natIp: publicIp ? publicIp.address : undefined,
                            networkTier: effectiveNetworkTier,
                        }],
                    }],
                    networkPerformanceConfig: enableTier1Result
                        ? { totalEgressBandwidthTier: enableTier1Result.totalEgressBandwidthTier }
                        : undefined,
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
                        instanceTerminationAction: args.useSpot ? "STOP" : undefined, // instanceTerminationAction is only allowed for spot instances
                        preemptible: args.useSpot ?? false
                    },
                };
                return new gcp.compute.Instance(`${name}-gce-instance`, instanceArgs, {
                    ...commonPulumiOpts,
                    // Ignore bootDisk changes to avoid machine replacement on change (user's data loss)
                    // TODO support such change while keeping user's data
                    ignoreChanges: [ "bootDisk.initializeParams" ]
                });
            });

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

            // Extract boot disk ID (name) from instance
            this.rootDiskId = gceInstance.bootDisk.apply(bd => bd.source?.split("/").pop() ?? null)
        } else {
            this.instanceName = pulumi.output(gcpResourceNamePrefix)
            this.publicIp = publicIp ? publicIp.address : pulumi.output("") 
            this.rootDiskId = pulumi.output(null)
        }

        if(args.costAlert){ 
            const budgetEmailNotifChannel = new gcp.monitoring.NotificationChannel(`${name}-budget-email-notif-channel`, {
                displayName: `Cloudy Pad ${name} budget alert email channel`,
                type: "email",
                labels: {
                    email_address: args.costAlert.notificationEmail,
                },
            }, commonPulumiOpts)

            const project = gcp.organizations.getProjectOutput({ projectId: args.projectId })

            const budgetArgs = pulumi.all([project, args.costAlert, budgetEmailNotifChannel.id]).apply(([project, costAlert, budgetEmailNotifChannelId]) => {
                return {
                    billingAccount: project.billingAccount,
                    displayName: `Cloudy Pad ${name} budget`,
                    amount: {
                        specifiedAmount: {
                            // Don't force currency code otherwise API call fails with 400
                            // See https://github.com/hashicorp/terraform-provider-google/issues/19796#issuecomment-2419676946
                            // currencyCode: "USD", 
                            units: costAlert.limit.toString(),
                        },
                    },  
                    thresholdRules: [
                        {
                        thresholdPercent: 1.0,
                        spendBasis: "CURRENT_SPEND",
                    }, 
                    {
                        thresholdPercent: 0.8,
                        spendBasis: "CURRENT_SPEND",
                    },
                    {
                        thresholdPercent: 0.5,
                        spendBasis: "CURRENT_SPEND",
                        },
                    ],
                    budgetFilter: {
                        projects: [
                            `projects/${project.number}`
                        ],
                    },
                    allUpdatesRule: {
                        monitoringNotificationChannels: [budgetEmailNotifChannelId],
                    }
                }
            })
            
            budgetArgs.apply(b => {
                console.info(`Budget args: ${JSON.stringify(b, null, 2)}`)
            })

            const gcpProvider = new gcp.Provider("gcp-provider", {
                project: args.projectId,
                billingProject: args.projectId,
                userProjectOverride: true,
            })

            new gcp.billing.Budget(`${name}-budget`, {
                billingAccount: project.apply(p => p.billingAccount),
                displayName: `Cloudy Pad ${name} budget`,
                amount: {
                    specifiedAmount: {
                        // Don't force currency code otherwise API call fails with 400
                        // See https://github.com/hashicorp/terraform-provider-google/issues/19796#issuecomment-2419676946
                        // currencyCode: "USD",
                        units: args.costAlert.limit.toString(),
                    },
                },  
                thresholdRules: [
                    {
                        thresholdPercent: 1.0,
                        spendBasis: "CURRENT_SPEND",
                    }, 
                    {
                        thresholdPercent: 0.8,
                        spendBasis: "CURRENT_SPEND",
                    },
                    {
                        thresholdPercent: 0.5,
                        spendBasis: "CURRENT_SPEND",
                    },
                ],
                budgetFilter: {
                    projects: [
                        pulumi.interpolate`projects/${project.number}`
                    ],
                },
                allUpdatesRule: {
                    monitoringNotificationChannels: [budgetEmailNotifChannel.id],
                },
            }, {
                ...commonPulumiOpts,
                provider: gcpProvider,
            })  
        }
    }
}

import { TIER1_FAMILIES, TIER1_NIC } from "../const";

function supportsTier1(machineType?: string, nicType?: string): boolean {
    if (!machineType) return false;
    const family = machineType.split("-")[0].toLowerCase();
    const nicOk = !nicType || nicType.toUpperCase() === TIER1_NIC;
    return TIER1_FAMILIES.some(f => f === family) && nicOk;
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function gcpPulumiProgram(): Promise<Record<string, any> | void> {

    const gcpConfig = new pulumi.Config("gcp");
    const projectId = gcpConfig.require("project");
    const zone = gcpConfig.require("zone");

    const config = new pulumi.Config();
    const machineType = config.require("machineType");
    const acceleratorType = config.require("acceleratorType");
    const bootDiskSizeGB = config.requireNumber("bootDiskSizeGB");
    const publicIpType = config.require("publicIpType");
    const publicKeyContent = config.require("publicSshKeyContent");
    const useSpot = config.requireBoolean("useSpot");
    const costAlert = config.getObject<CostAlertOptions>("costAlert");
    const firewallAllowPorts = config.requireObject<SimplePortDefinition[]>("firewallAllowPorts")

    const diskType = config.get("diskType");        
    const networkTier = config.get("networkTier");
    const nicType = config.get("nicType");
    const dataDisk = config.getObject<CloudyPadGCEInstanceArgs["dataDisk"]>("dataDisk")
    const imageId = config.get("imageId")
    const instanceServerState = config.get("instanceServerState") as "present" | "absent" | undefined

    const bootDiskTypeUrl = diskType ? `zones/${zone}/diskTypes/${diskType}` : undefined;

    const instanceName = pulumi.getStack();

    const instance = new CloudyPadGCEInstance(instanceName, {
        projectId: projectId,
        machineType: machineType,
        acceleratorType: acceleratorType, 
        publicKeyContent: publicKeyContent,
        bootDisk: {
            sizeGb: bootDiskSizeGB,
            type: bootDiskTypeUrl, // e.g. zones/europe-west4-b/diskTypes/pd-ssd
        },
        imageId: imageId,
        instanceServerState: instanceServerState,
        dataDisk: dataDisk,
        networkTier: networkTier,
        nicType: nicType,
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
        costAlert: costAlert,
        firewallAllowPorts: firewallAllowPorts.map(p => ({
            ports: [p.port.toString()],
            protocol: p.protocol,
        })),
    });

    return {
        instanceName: instance.instanceName,
        publicIp: instance.publicIp,
        dataDiskId: instance.dataDiskId,
        rootDiskId: instance.rootDiskId
    };
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
    costAlert?: CostAlertOptions
    firewallAllowPorts: SimplePortDefinition[]
    diskType?: string
    networkTier?: string
    nicType?: string
    imageId?: string
    instanceServerState?: "present" | "absent"
    dataDisk?: {
        state: "present" | "absent"
        sizeGb: number
        snapshotId?: string
    }
}

export interface GcpPulumiOutput {
    instanceName: string
    publicIp: string
    dataDiskId?: string | null
    rootDiskId?: string | null
}

export interface GcpPulumiClientArgs {
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}

export class GcpPulumiClient extends InstancePulumiClient<PulumiStackConfigGcp, GcpPulumiOutput> {

    constructor(args: GcpPulumiClientArgs){
        super({ 
            program: gcpPulumiProgram, 
            projectName: "CloudyPad-GCP", 
            stackName: args.stackName, 
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigGcp){
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
        await stack.setConfig("firewallAllowPorts", { value: JSON.stringify(config.firewallAllowPorts)})
        if (config.diskType) await stack.setConfig("diskType", { value: config.diskType })
        if (config.networkTier) await stack.setConfig("networkTier", { value: config.networkTier })
        if (config.nicType) await stack.setConfig("nicType", { value: config.nicType })
        if (config.imageId) await stack.setConfig("imageId", { value: config.imageId })
        if (config.instanceServerState) await stack.setConfig("instanceServerState", { value: config.instanceServerState })
        if (config.dataDisk) await stack.setConfig("dataDisk", { value: JSON.stringify(config.dataDisk) })

        if(config.costAlert){
            await stack.setConfig("costAlert", { value: JSON.stringify(config.costAlert)})
        }

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Config after update: ${JSON.stringify(allConfs)}`)
    }

    protected async buildTypedOutput(outputs: OutputMap): Promise<GcpPulumiOutput>{
        return {
            instanceName: outputs["instanceName"].value as string,
            publicIp: outputs["publicIp"].value as string,
            dataDiskId: outputs["dataDiskId"]?.value as string | null | undefined,
            rootDiskId: outputs["rootDiskId"]?.value as string | null | undefined
        }
    }
}