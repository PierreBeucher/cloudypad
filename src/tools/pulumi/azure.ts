import * as az from "@pulumi/azure-native"
import * as pulumi from "@pulumi/pulumi"
import { InstancePulumiClient } from "./client"
import { OutputMap } from "@pulumi/pulumi/automation"

interface PortDefinition {
    from: pulumi.Input<number>,
    to?: pulumi.Input<number>,
    protocol?: pulumi.Input<string>,
    sourceAddressPrefix?: pulumi.Input<string>
}

interface VolumeArgs {
    sizeGb: pulumi.Input<number>
    type?: pulumi.Input<string>
    deviceName: string
}

interface CloudyPadVMArgs {
    networkSecurityGroupRules?: PortDefinition[]
    publicKeyContent?: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    vmSize: pulumi.Input<string>
    osDisk: VolumeArgs
    publicIpType?: pulumi.Input<string>
    priority?: pulumi.Input<string>
    evictionPolicy?: pulumi.Input<string>
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
            securityRules: args.networkSecurityGroupRules?.map((rule, index) => ({
                name: `${name}-rule-${index}`,
                protocol: rule.protocol || "*",
                sourcePortRange: "*",
                destinationPortRange: rule.to ? `${rule.from}-${rule.to}` : `${rule.from}`,
                sourceAddressPrefix: rule.sourceAddressPrefix || "*",
                destinationAddressPrefix: "*",
                access: "Allow",
                priority: 100 + index,
                direction: "Inbound",
            })),
            tags: globalTags
        }, commonPulumiOpts)

        const publicIp = args.publicIpType === "static" ? 
            new az.network.PublicIPAddress(`${name}-public-ip`, {
                resourceGroupName: resourceGroup.name,
                publicIPAllocationMethod: "Static",
                sku: { name: "Standard" },
                tags: globalTags
            }, commonPulumiOpts) : undefined

        const networkInterface = new az.network.NetworkInterface(`${name}-network-interface`, {
            resourceGroupName: resourceGroup.name,
            networkSecurityGroup: {
                id: nsg.id
            },
            ipConfigurations: [{
                name: `${name}-ipcfg`,
                privateIPAllocationMethod: "Dynamic",
                publicIPAddress: publicIp ? { id: publicIp.id } : undefined,
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
                imageReference: {
                    publisher: "Canonical",
                    offer: "0001-com-ubuntu-server-jammy",
                    sku: "22_04-lts-gen2",
                    version: "latest",
                },
                osDisk: {
                    createOption: "FromImage",
                    managedDisk: {
                        storageAccountType: args.osDisk.type || "Standard_LRS"
                    },
                    diskSizeGB: args.osDisk.sizeGb,
                    name: `${name}-osdisk`,
                },
            },
            priority: args.priority,
            evictionPolicy: args.evictionPolicy,
            tags: globalTags
        }, commonPulumiOpts)

        this.resourceGroupName = resourceGroup.name
        this.vmName = vm.name
        this.publicIp = publicIp ? publicIp.ipAddress : networkInterface.ipConfigurations.apply(ips => {
            if(ips && ips.length == 1 && ips[0].publicIPAddress?.ipAddress) {
                return ips[0].publicIPAddress.ipAddress
            }

            throw new Error(`Expected a single IP, got: ${JSON.stringify(ips)}`)  
        })

        
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
async function azurePulumiProgram(): Promise<Record<string, any> | void> {
    const config = new pulumi.Config()
    const vmSize = config.require("vmSize")
    const publicKeyContent = config.require("publicSshKeyContent")
    const rootDiskSizeGB = config.requireNumber("rootDiskSizeGB")
    const publicIpType = config.require("publicIpType")
    const useSpot = config.requireBoolean("useSpot")

    const instanceName = pulumi.getStack()

    const instance = new CloudyPadAzureInstance(instanceName, {
        vmSize: vmSize,
        publicKeyContent: publicKeyContent,
        osDisk: {
            type: "Standard_LRS",
            sizeGb: rootDiskSizeGB,
            deviceName: `${instanceName}-osdisk`
        },
        publicIpType: publicIpType,
        networkSecurityGroupRules: [
            { from: 22, protocol: "Tcp", sourceAddressPrefix: "*" }, // SSH
            { from: 80, protocol: "Tcp", sourceAddressPrefix: "*" }, // HTTP
            { from: 443, protocol: "Tcp", sourceAddressPrefix: "*" }, // HTTPS
            { from: 47984, protocol: "tcp" }, // HTTP
            { from: 47989, protocol: "tcp" }, // HTTPS
            { from: 48010, protocol: "tcp" }, // RTSP
            { from: 47999, protocol: "udp" }, // Control
            { from: 48100, to: 48110, protocol: "udp" }, // Video (up to 10 users)
            { from: 48200, to: 48210, protocol: "udp" }, // Audio (up to 10 users)
        ],
        
        // Spot config if enabled
        priority: useSpot ? "Spot" : undefined,
        evictionPolicy: useSpot ? "Deallocate" : undefined,
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
    publicSshKeyContent: string
    publicIpType: string
    useSpot: boolean
}

export interface AzurePulumiOutput {
    vmName: string
    publicIp: string
    resourceGroupName: string
}


export class AzurePulumiClient extends InstancePulumiClient<PulumiStackConfigAzure, AzurePulumiOutput> {

    constructor(stackName: string){
        super({ program: azurePulumiProgram, projectName: "CloudyPad-Azure", stackName: stackName})
    }

    async setConfig(config: PulumiStackConfigAzure){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("azure-native:location", { value: config.location})
        await stack.setConfig("azure-native:subscriptionId", { value: config.subscriptionId})

        await stack.setConfig("vmSize", { value: config.vmSize})
        await stack.setConfig("rootDiskSizeGB", { value: config.rootDiskSizeGB.toString()})
        await stack.setConfig("publicSshKeyContent", { value: config.publicSshKeyContent})
        await stack.setConfig("publicIpType", { value: config.publicIpType})
        await stack.setConfig("useSpot", { value: config.useSpot.toString()})

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