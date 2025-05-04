import * as az from "@pulumi/azure-native"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "../../tools/pulumi/client"
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation"
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_STATIC, SimplePortDefinition } from "../../core/const"
import { CostAlertOptions } from "../../core/provisioner"

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

interface CloudyPadVMArgs {
    networkSecurityGroupRules?: pulumi.Input<pulumi.Input<az.types.input.network.SecurityRuleArgs>[]>
    publicKeyContent?: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    vmSize: pulumi.Input<string>
    osDisk: VolumeArgs
    publicIpType?: pulumi.Input<string>
    priority?: pulumi.Input<string>
    evictionPolicy?: pulumi.Input<string>,
    costAlert?: {
        limit: pulumi.Input<number>
        notificationEmail: pulumi.Input<string>
    }
}

class CloudyPadAzureInstance extends pulumi.ComponentResource {
    public readonly publicIp: pulumi.Output<string | undefined>
    public readonly vmName: pulumi.Output<string>
    public readonly resourceGroupName: pulumi.Output<string>

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
        const vm = new az.compute.VirtualMachine(`${name}-vm`, {
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
            storageProfile: {
                // Specify most precise version for better reproducibility
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
                },
            },
            priority: args.priority,
            evictionPolicy: args.evictionPolicy,
            tags: globalTags
        }, {
            ...commonPulumiOpts,
            // ignore imageReference and storageAccountType change to avoid destroying instance on update
            // TODO support such change while keeping user's data
            ignoreChanges: [ 
                "storageProfile.imageReference",
                "storageProfile.osDisk.managedDisk.storageAccountType",
            ]
        })

        this.resourceGroupName = resourceGroup.name
        this.vmName = vm.name
        this.publicIp = publicIp.ipAddress ? publicIp.ipAddress : networkInterface.ipConfigurations.apply(ips => {
            if(ips && ips.length == 1 && ips[0].publicIPAddress?.ipAddress) {
                return ips[0].publicIPAddress.ipAddress
            }

            throw new Error(`Expected a single Public IP, got: ${JSON.stringify(ips)}`)  
        })

        const startDate = `${new Date().getFullYear()}-${new Date().getMonth()+1}-01`

        console.info(`Start date: ${startDate}`)

        if(args.costAlert) {
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

    const instanceName = pulumi.getStack()


    const instance = new CloudyPadAzureInstance(instanceName, {
        vmSize: vmSize,
        publicKeyContent: publicKeyContent,
        osDisk: {
            type: rootDiskType,
            sizeGb: rootDiskSizeGB,
            deviceName: `${instanceName}-osdisk`
        },
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
        costAlert: costAlert
    })

    return {
        vmName: instance.vmName,
        publicIp: instance.publicIp,
        resourceGroupName: instance.resourceGroupName
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
}

export interface AzurePulumiOutput {
    vmName: string
    publicIp: string
    resourceGroupName: string
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

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Config after update: ${JSON.stringify(allConfs)}`)

    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<AzurePulumiOutput>{
        return {
            vmName: outputs["vmName"].value as string, // TODO validate with Zod
            publicIp: outputs["publicIp"].value as string,
            resourceGroupName: outputs["resourceGroupName"].value as string
        }   
    }

}