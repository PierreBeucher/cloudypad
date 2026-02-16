import * as az from "@pulumi/azure-native"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../../tools/pulumi/client"
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation"
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_STATIC, SimplePortDefinition } from "../../../core/const"
import { CostAlertOptions } from "../../../core/provisioner"

interface PortDefinition {
    from: pulumi.Input<number>,
    to?: pulumi.Input<number>,
    protocol?: pulumi.Input<string>,
    sourceAddressPrefix?: pulumi.Input<string>
}

interface VolumeArgs {
    sizeGb: pulumi.Input<number>
    type: pulumi.Input<string>
    deviceName: string
}

interface DataDiskArgs {
    state: "present" | "absent"
    sizeGb: number
    snapshotId?: string
}

interface CloudyPadVMArgs {
    networkSecurityGroupRules?: pulumi.Input<pulumi.Input<az.types.input.network.SecurityRuleArgs>[]>
    publicKeyContent?: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    vmSize: pulumi.Input<string>
    osDisk: VolumeArgs
    dataDisk?: DataDiskArgs
    publicIpType?: pulumi.Input<string>
    priority?: pulumi.Input<string>
    evictionPolicy?: pulumi.Input<string>,
    costAlert?: {
        limit: pulumi.Input<number>
        notificationEmail: pulumi.Input<string>
    }
    instanceServerState?: "present" | "absent"
    imageId?: pulumi.Input<string>
}

class CloudyPadAzureInstance extends pulumi.ComponentResource {
    public readonly publicIp: pulumi.Output<string | undefined>
    public readonly vmName: pulumi.Output<string | undefined>
    public readonly resourceGroupName: pulumi.Output<string>
    public readonly rootDiskId: pulumi.Output<string | undefined>
    public readonly dataDiskId: pulumi.Output<string | undefined>
    public readonly dataDiskLun: pulumi.Output<number | undefined>

    constructor(name: string, args: CloudyPadVMArgs, opts?: pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:azure:vm", name, args, opts)

        const globalTags = {
            ...args.tags,
            Name: name,
        }

        const commonPulumiOpts = {
            parent: this
        }

        const resourceGroup = new az.resources.ResourceGroup(name, {
            resourceGroupName: `CloudyPad-${name}`,
        }, commonPulumiOpts)

        const vnet = new az.network.VirtualNetwork(`${name}-vnet`, {
            virtualNetworkName: `${name}-vnet`,
            resourceGroupName: resourceGroup.name,
            addressSpace: {
                addressPrefixes: ["10.0.0.0/16"]
            }
        }, commonPulumiOpts)

       const subnet = new az.network.Subnet(`${name}-subnet`, {
            name: `${name}-subnet`,
            subnetName: `${name}-subnet`,
            resourceGroupName: resourceGroup.name,
            virtualNetworkName: vnet.name,
            addressPrefix: "10.0.0.0/16",
        }, commonPulumiOpts)

        const nsg = new az.network.NetworkSecurityGroup(`${name}-nsg`, {
            resourceGroupName: resourceGroup.name,
            securityRules: args.networkSecurityGroupRules,
            tags: globalTags
        }, commonPulumiOpts)

        const publicIp = args.publicIpType === PUBLIC_IP_TYPE_STATIC ?
            new az.network.PublicIPAddress(`${name}-public-ip`, {
                resourceGroupName: resourceGroup.name,
                publicIPAllocationMethod: "Static",
                sku: { name: "Standard" },
                tags: globalTags
            }, commonPulumiOpts)
        : // args.publicIpType === PUBLIC_IP_TYPE_DYNAMIC
            new az.network.PublicIPAddress(`${name}-public-ip`, {
                resourceGroupName: resourceGroup.name,
                publicIPAllocationMethod: "Dynamic",
                sku: { name: "Basic" },
                tags: globalTags
            }, commonPulumiOpts)

        const networkInterface = new az.network.NetworkInterface(`${name}-network-interface`, {
            resourceGroupName: resourceGroup.name,
            networkSecurityGroup: {
                id: nsg.id
            },
            ipConfigurations: [{
                name: `${name}-ipcfg`,
                privateIPAllocationMethod: "Dynamic",
                publicIPAddress: { id: publicIp.id },
                subnet: {
                    id: subnet.id,
                },
            }],
            tags: globalTags
        }, commonPulumiOpts)

        const adminUsername = "ubuntu"
        
        // Create data disk if requested and state is set and not "absent"
        // Copy disk from snapshot if snapshotId is provided
        // Otherwise create an empty disk
        let dataDisk: az.compute.Disk | undefined = undefined
        if (args.dataDisk && args.dataDisk.state !== "absent") {
            dataDisk = new az.compute.Disk(`${name}-data-disk`, {
                diskName: `${name}-data-disk`,
                resourceGroupName: resourceGroup.name,
                diskSizeGB: args.dataDisk.sizeGb,
                creationData: args.dataDisk.snapshotId ? {
                    createOption: "Copy",
                    sourceResourceId: args.dataDisk.snapshotId,
                } : {
                    createOption: "Empty",
                },
                tags: globalTags
            }, commonPulumiOpts)
        }

        // Only create VM if instanceServerState is not explicitly "absent"
        let vm: az.compute.VirtualMachine | undefined = undefined
        if (args.instanceServerState !== "absent") {
            // Build storage profile based on whether custom image is provided
            const storageProfile: az.types.input.compute.StorageProfileArgs = args.imageId ? {
                // Use custom image
                imageReference: {
                    id: args.imageId
                },
                osDisk: {
                    createOption: "FromImage",
                    managedDisk: {
                        storageAccountType: args.osDisk.type
                    },
                    diskSizeGB: args.osDisk.sizeGb,
                    name: `${name}-osdisk`,
                    deleteOption: "Delete", // Delete OS disk when VM is deleted
                },
            } : {
                // Use default Ubuntu image
                imageReference: {
                    publisher: "Canonical",
                    offer: "0001-com-ubuntu-server-jammy",
                    sku: "22_04-lts-gen2",
                    version: "22.04.202410020",
                },
                osDisk: {
                    createOption: "FromImage",
                    managedDisk: {
                        storageAccountType: args.osDisk.type
                    },
                    diskSizeGB: args.osDisk.sizeGb,
                    name: `${name}-osdisk`,
                    deleteOption: "Delete", // Delete OS disk when VM is deleted
                },
            }

            // Add data disks array if data disk exists
            if (dataDisk) {
                storageProfile.dataDisks = [{
                    lun: 0,
                    createOption: "Attach",
                    managedDisk: {
                        id: dataDisk.id
                    }
                }]
            }

            vm = new az.compute.VirtualMachine(`${name}-vm`, {
                vmName: `${name}-vm`,
                resourceGroupName: resourceGroup.name,
                networkProfile: {
                    networkInterfaces: [{ id: networkInterface.id}]
                },
                hardwareProfile: { vmSize: args.vmSize },
                osProfile: {
                    computerName: name,
                    adminUsername: adminUsername,
                    linuxConfiguration: {
                        disablePasswordAuthentication: true,
                        ssh: {
                            publicKeys: [{
                                path: `/home/${adminUsername}/.ssh/authorized_keys`,
                                keyData: args.publicKeyContent,
                            }],
                        },
                    },
                },
                storageProfile: storageProfile,
                priority: args.priority,
                evictionPolicy: args.evictionPolicy,
                tags: globalTags
            }, {
                ...commonPulumiOpts,
                // ignore imageReference and storageAccountType change to avoid destroying instance on update
                ignoreChanges: [ 
                    "storageProfile.imageReference",
                    "storageProfile.osDisk.managedDisk.storageAccountType",
                ]
            })
        }

        this.resourceGroupName = resourceGroup.name
        this.vmName = vm ? vm.name : pulumi.output(undefined)
        this.publicIp = publicIp.ipAddress ? publicIp.ipAddress : networkInterface.ipConfigurations.apply(ips => {
            if(ips && ips.length == 1 && ips[0].publicIPAddress?.ipAddress) {
                return ips[0].publicIPAddress.ipAddress
            }

            throw new Error(`Expected a single Public IP, got: ${JSON.stringify(ips)}`)  
        })
        
        // Get root disk ID from VM if it exists
        this.rootDiskId = vm ? vm.storageProfile.apply(sp => sp?.osDisk?.managedDisk?.id) : pulumi.output(undefined)
        
        // Get data disk ID if it exists
        this.dataDiskId = dataDisk ? dataDisk.id : pulumi.output(undefined)
        
        // Get data disk LUN if data disk exists (always 0 for our data disk)
        this.dataDiskLun = dataDisk ? pulumi.output(0) : pulumi.output(undefined)

        if(args.costAlert) {

            // Cost alert scoped to current month
            // Azure REQUIRES the date to be near current date or at least current month
            // to avoid issue, generate a date each time
            const startDate = `${new Date().getFullYear()}-${new Date().getMonth()+1}-01`
            
            // Cost alert scoped to instance resource group
            const costAlert = new az.costmanagement.Budget(`${name}-cost-alert`, {
                category: "Cost",
                budgetName: `cloudypad-cost-alert-${name}`,
                scope: resourceGroup.id,
                amount: args.costAlert.limit,
                timeGrain: "Monthly",
                timePeriod: {
                    startDate: startDate
                },
                notifications: {
                    "100%": {
                        enabled: true,
                        contactEmails: [args.costAlert.notificationEmail],
                        thresholdType: "Actual",
                        operator: "GreaterThanOrEqualTo",
                        threshold: 100,
                    },
                    "80%": {
                        enabled: true,
                        contactEmails: [args.costAlert.notificationEmail],
                        thresholdType: "Actual",
                        operator: "GreaterThanOrEqualTo",
                        threshold: 80,
                    },
                    "50%": {
                        enabled: true,
                        contactEmails: [args.costAlert.notificationEmail],
                        thresholdType: "Actual",
                        operator: "GreaterThanOrEqualTo",
                        threshold: 50,
                    }
                },
            }, commonPulumiOpts)
        }        
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function azurePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const vmSize = config.require("vmSize")
    const publicKeyContent = config.require("publicSshKeyContent")
    const rootDiskSizeGB = config.requireNumber("rootDiskSizeGB")
    const rootDiskType = config.require("rootDiskType")
    const publicIpType = config.require("publicIpType")
    const useSpot = config.requireBoolean("useSpot")
    const costAlert = config.getObject<CostAlertOptions>("costAlert")
    const securityGroupPorts = config.requireObject<SimplePortDefinition[]>("securityGroupPorts")
    const instanceServerState = config.get("instanceServerState") as "present" | "absent" | undefined
    const imageId = config.get("imageId")
    const dataDiskConfig = config.getObject<DataDiskArgs>("dataDisk")

    const instanceName = pulumi.getStack()

    const instance = new CloudyPadAzureInstance(instanceName, {
        vmSize: vmSize,
        publicKeyContent: publicKeyContent,
        osDisk: {
            type: rootDiskType,
            sizeGb: rootDiskSizeGB,
            deviceName: `${instanceName}-osdisk`
        },
        dataDisk: dataDiskConfig,
        publicIpType: publicIpType,
        networkSecurityGroupRules: securityGroupPorts.map((p, index) => ({
            name: `${instanceName}-rule-${index}`,
            protocol: p.protocol,
            sourcePortRange: "*",
            destinationPortRange: p.port.toString(),
            sourceAddressPrefix: "*",
            destinationAddressPrefix: "*",
            access: "Allow",
            priority: 100 + index,
            direction: "Inbound",
        })),
        // Spot config if enabled
        priority: useSpot ? "Spot" : undefined,
        evictionPolicy: useSpot ? "Deallocate" : undefined,
        costAlert: costAlert,
        instanceServerState: instanceServerState,
        imageId: imageId,
    })

    return {
        vmName: instance.vmName,
        publicIp: instance.publicIp,
        resourceGroupName: instance.resourceGroupName,
        rootDiskId: instance.rootDiskId,
        dataDiskId: instance.dataDiskId,
        dataDiskLun: instance.dataDiskLun,
    }
}

export interface PulumiStackConfigAzure {
    subscriptionId: string
    location: string
    vmSize: string
    rootDiskSizeGB: number
    rootDiskType: string
    publicSshKeyContent: string
    publicIpType: PUBLIC_IP_TYPE
    useSpot: boolean,
    costAlert?: CostAlertOptions,
    securityGroupPorts: SimplePortDefinition[]
    instanceServerState?: "present" | "absent"
    imageId?: string
    dataDisk?: DataDiskArgs
}

export interface AzurePulumiOutput {
    vmName?: string
    publicIp: string
    resourceGroupName: string
    rootDiskId?: string
    dataDiskId?: string
    dataDiskLun?: number
}

export interface AzurePulumiClientArgs {
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}

export class AzurePulumiClient extends InstancePulumiClient<PulumiStackConfigAzure, AzurePulumiOutput> {

    constructor(args: AzurePulumiClientArgs){
        super({ 
            program: azurePulumiProgram, 
            projectName: "CloudyPad-Azure", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAzure){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("azure-native:location", { value: config.location})
        await stack.setConfig("azure-native:subscriptionId", { value: config.subscriptionId})

        await stack.setConfig("vmSize", { value: config.vmSize})
        await stack.setConfig("rootDiskSizeGB", { value: config.rootDiskSizeGB.toString()})
        await stack.setConfig("rootDiskType", { value: config.rootDiskType})
        await stack.setConfig("publicSshKeyContent", { value: config.publicSshKeyContent})
        await stack.setConfig("publicIpType", { value: config.publicIpType})
        await stack.setConfig("useSpot", { value: config.useSpot.toString()})
        await stack.setConfig("securityGroupPorts", { value: JSON.stringify(config.securityGroupPorts)})

        if(config.costAlert){
            await stack.setConfig("costAlert", { value: JSON.stringify(config.costAlert)})
        }

        if(config.instanceServerState){
            await stack.setConfig("instanceServerState", { value: config.instanceServerState})
        }

        if(config.imageId){
            await stack.setConfig("imageId", { value: config.imageId})
        }

        if(config.dataDisk){
            await stack.setConfig("dataDisk", { value: JSON.stringify(config.dataDisk)})
        }

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Config after update: ${JSON.stringify(allConfs)}`)

    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<AzurePulumiOutput>{
        return {
            vmName: outputs["vmName"]?.value as string | undefined,
            publicIp: outputs["publicIp"].value as string,
            resourceGroupName: outputs["resourceGroupName"].value as string,
            rootDiskId: outputs["rootDiskId"]?.value as string | undefined,
            dataDiskId: outputs["dataDiskId"]?.value as string | undefined,
            dataDiskLun: outputs["dataDiskLun"]?.value as number | undefined,
        }   
    }

}