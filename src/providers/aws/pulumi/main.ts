import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { LocalWorkspaceOptions, OutputMap } from "@pulumi/pulumi/automation";
import { InstancePulumiClient } from "../../../tools/pulumi/client";
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC, SimplePortDefinition } from "../../../core/const";

interface VolumeArgs {
    size: pulumi.Input<number>
    type?: pulumi.Input<string>
    deviceName: string
    encrypted?: pulumi.Input<boolean>
    availabilityZone?: pulumi.Input<string>
    iops?: pulumi.Input<number>
    throughput?: pulumi.Input<number>
}

interface CloudyPadEC2instanceArgs {
    vpcId?: pulumi.Input<string>
    subnetId?: pulumi.Input<string>
    ingressPorts?: pulumi.Input<pulumi.Input<aws.types.input.ec2.SecurityGroupIngress>[]>
    publicKeyContent?: pulumi.Input<string>
    existingKeyPair?: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    ami: pulumi.Input<string>;
    type: pulumi.Input<string>;
    availabilityZone?: pulumi.Input<string>
    publicIpType?: pulumi.Input<string>
    rootVolume?: {
        sizeGb?: pulumi.Input<number>
        type?: pulumi.Input<string>
        encrypted?: pulumi.Input<boolean>
    }
    additionalVolumes?: VolumeArgs[]
    dataDisk?: {
        state: "present" | "absent"
        sizeGb: pulumi.Input<number>
        snapshotId?: pulumi.Input<string>
    }
    instanceServerState?: "present" | "absent"

    /**
     * Spot instance usage configuration
     */
    spot?: {

        /**
         * Whether to use spot instance
         */
        enabled?: pulumi.Input<boolean>
    }

    billingAlert?: {
        limit: pulumi.Input<string>
        notificationEmail: pulumi.Input<string>
    }

    /**
     * Ignore changes to public key used to create instance.
     * This allow to pass any value to public key without destroying instance
     */
    ignorePublicKeyChanges?: pulumi.Input<boolean>
}

/**
 * Multiple replicas of CompositeEC2Instance
 */
class CloudyPadEC2Instance extends pulumi.ComponentResource {
    
    private readonly ec2Instance?: aws.ec2.Instance
    private readonly volumes: aws.ebs.Volume[]
    private readonly dataDisk?: aws.ebs.Volume
    private readonly keyPair?: aws.ec2.KeyPair
    private readonly securityGroup: aws.ec2.SecurityGroup
    private readonly eip?: aws.ec2.Eip
    private readonly keyPairName: pulumi.Output<string>

    readonly publicIp: pulumi.Output<string>
    readonly instanceId?: pulumi.Output<string>
    readonly rootVolumeId?: pulumi.Output<string>
    readonly dataDiskId?: pulumi.Output<string>

    constructor(name: string, args: CloudyPadEC2instanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudypad:aws:ec2-instance", name, args, opts);

        const awsResourceNamePrefix = `CloudyPad-${name}`

        const globalTags = {
            ...args.tags,
            Name: awsResourceNamePrefix,
        }

        const commonPulumiOpts = {
            parent: this
        }

        if(args.billingAlert){
            const ec2 = new aws.budgets.Budget(`${name}-cost-alert`, {
                name: `${name}-cost-alert`,
                budgetType: "COST",
                limitAmount: args.billingAlert.limit,
                limitUnit: "USD",
                timeUnit: "MONTHLY",
                notifications: [
                    {
                        comparisonOperator: "GREATER_THAN",
                        threshold: 50,
                        thresholdType: "PERCENTAGE",
                        notificationType: "ACTUAL",
                        subscriberEmailAddresses: [args.billingAlert.notificationEmail],
                    },
                    {
                        comparisonOperator: "GREATER_THAN",
                        threshold: 80,
                        thresholdType: "PERCENTAGE",
                        notificationType: "ACTUAL",
                        subscriberEmailAddresses: [args.billingAlert.notificationEmail],
                    },
                    {
                        comparisonOperator: "GREATER_THAN",
                        threshold: 100,
                        thresholdType: "PERCENTAGE",
                        notificationType: "ACTUAL",
                        subscriberEmailAddresses: [args.billingAlert.notificationEmail],
                    },
                ]
            })
        }

        this.securityGroup = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: args.vpcId,
            ingress: args.ingressPorts,
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
                ipv6CidrBlocks: ["::/0"],
            }],
            name: awsResourceNamePrefix,
            tags: globalTags
        }, commonPulumiOpts);

        if (args.existingKeyPair && args.publicKeyContent) {
            throw new Error("existingKeyPair and publicKeyContent are mutually exclusive, only set one or the other.")
        } else if (args.publicKeyContent){
            this.keyPair = new aws.ec2.KeyPair(`${name}-keypair`, {
                publicKey: args.publicKeyContent,
                keyName: awsResourceNamePrefix
            }, {
                ...commonPulumiOpts,
                ignoreChanges: args.ignorePublicKeyChanges ? [ "publicKey" ] : []
            })

            this.keyPairName = this.keyPair.keyName
        } else if (args.existingKeyPair) {
            this.keyPairName = pulumi.output(args.existingKeyPair)
        } else {
            throw new Error("One of publicKeyContent or existingKeyPair is required")
        }

        // Create instance server if state is not explicitly set to absent
        if(args.instanceServerState !== "absent"){

            let instanceMarketOptions: pulumi.Input<aws.types.input.ec2.InstanceInstanceMarketOptions> | undefined = undefined
            if(args.spot?.enabled){
                instanceMarketOptions =  {
                    marketType: "spot",
                    spotOptions:  {
                        instanceInterruptionBehavior: "stop",
                        spotInstanceType: "persistent",
                    }
                }
            }

            this.ec2Instance = new aws.ec2.Instance(`${name}-ec2-instance`, {
                ami: args.ami,
                instanceType: args.type,
                availabilityZone: args.availabilityZone,
                tags:  {
                    ...args.tags,
                    Name: awsResourceNamePrefix
                },
                volumeTags: args.tags,
                vpcSecurityGroupIds: [this.securityGroup.id],
                keyName: this.keyPairName,
                rootBlockDevice: {
                    encrypted:  args.rootVolume?.encrypted || true,
                    volumeSize: args.rootVolume?.sizeGb,
                    volumeType: args.rootVolume?.type
                },
                instanceMarketOptions: instanceMarketOptions,
                subnetId: args.subnetId,
                associatePublicIpAddress: true,
            }, {
                ...commonPulumiOpts,
                ignoreChanges: [
                    "associatePublicIpAddress",
                    // Don't update AMI as it will replace instance, destroying disk and user's data
                    // TODO support such change while keeping user's data
                    "ami" 
                ]
            })

            // Extract root disk ID from instance, corresponding to the root block device volume ID
            this.rootVolumeId = this.ec2Instance.rootBlockDevice.apply(rbd => rbd.volumeId)

            // Create data disk if requested and not explicitly disabled
            // Must be created after instance to get availability zone
            // Data disk is only created if instance server is enabled
            if(args.dataDisk && args.dataDisk.state !== "absent"){
                this.dataDisk = new aws.ebs.Volume(`${name}-data-disk`, {
                    encrypted: true,
                    size: args.dataDisk.sizeGb,
                    type: "gp3",
                    availabilityZone: this.ec2Instance.availabilityZone,
                    tags: globalTags,
                    snapshotId: args.dataDisk.snapshotId,
                }, {
                    ...commonPulumiOpts,
                    dependsOn: [this.ec2Instance]
                })
                
                new aws.ec2.VolumeAttachment(`${name}-data-disk-attach`, {
                    deviceName: "/dev/sdf",
                    volumeId: this.dataDisk.id,
                    instanceId: this.ec2Instance.id,
                }, {
                    ...commonPulumiOpts,
                    dependsOn: [this.ec2Instance, this.dataDisk]
                })
                
                this.dataDiskId = this.dataDisk.id
            } else {
                this.dataDiskId = undefined
            }

            this.volumes = []
            args.additionalVolumes?.forEach(v => {        
                const vol = new aws.ebs.Volume(`${name}-volume-${v.deviceName}`, {
                    encrypted: v.encrypted || true,
                    availabilityZone: v.availabilityZone || this.ec2Instance!.availabilityZone,
                    size: v.size,
                    type: v.type,
                    iops: v.iops,
                    throughput: v.throughput,
                    tags: globalTags
                }, commonPulumiOpts);
        
                new aws.ec2.VolumeAttachment(`${name}-volume-attach-${v.deviceName}`, {
                    deviceName: v.deviceName,
                    volumeId: vol.id,
                    instanceId: this.ec2Instance!.id,
                }, commonPulumiOpts);

                this.volumes.push(vol)
            })
            

            if (args.publicIpType === PUBLIC_IP_TYPE_STATIC) {
                this.eip = new aws.ec2.Eip(`${name}-eip`, {
                    tags: globalTags
                }, commonPulumiOpts);
                        
                new aws.ec2.EipAssociation(`${name}-eipAssoc`, {
                    instanceId: this.ec2Instance.id,
                    allocationId: this.eip.id,
                }, commonPulumiOpts);
            } else if (args.publicIpType !== PUBLIC_IP_TYPE_DYNAMIC) {
                throw `publicIpType must be either '${PUBLIC_IP_TYPE_STATIC}' or '${PUBLIC_IP_TYPE_DYNAMIC}'`
            }

            // set client-facing values
            this.instanceId = this.ec2Instance.id
        } else {
            // Instance server is absent - set outputs to empty
            this.instanceId = undefined
            this.rootVolumeId = undefined
            this.dataDiskId = undefined
            this.volumes = []
        }

        this.publicIp = this.eip ? this.eip.publicIp : this.ec2Instance?.publicIp || pulumi.output("")
    }
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
// Interface is set by Pulumi
async function awsPulumiProgram(): Promise<Record<string, any> | void> {

    const config = new pulumi.Config();
    const instanceType = config.require("instanceType");
    const rootVolumeSizeGB = config.requireNumber("rootVolumeSizeGB");
    const publicIpType = config.require("publicIpType");
    const publicKeyContent = config.require("publicSshKeyContent");
    const useSpot = config.requireBoolean("useSpot");
    const ingressPorts = config.requireObject<SimplePortDefinition[]>("ingressPorts")
    const imageId = config.get("imageId")
    const dataDisk = config.getObject<{ state: "present" | "absent", sizeGb: number, snapshotId?: string }>("dataDisk")
    const instanceServerState = config.get("instanceServerState") as "present" | "absent" | undefined
    const zone = config.get("zone")

    const billingAlertEnabled = config.requireBoolean("billingAlertEnabled");
    const billingAlertLimit = config.get("billingAlertLimit");
    const billingAlertNotificationEmail = config.get("billingAlertNotificationEmail");

    const instanceName = pulumi.getStack()

    // Use provided imageId if available, otherwise use default Ubuntu AMI
    const amiId = imageId ? pulumi.output(imageId) : aws.ec2.getAmiOutput({
        mostRecent: true,
        nameRegex: "^ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-[0-9]{8}$",
        filters: [
            {
                name: "name",
                // Use a specific version as much as possible to avoid reproducibility issues
                // Can't use AMI ID as it's region dependent 
                // and specifying AMI for all regions may not yield expected results and would be hard to maintain
                values: ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"],
            },
            {
                name: "virtualization-type",
                values: ["hvm"],
            },
        ],
        owners: ["099720109477"],
    }).imageId
    
    let billingAlert: {
        limit: pulumi.Input<string>
        notificationEmail: pulumi.Input<string>
    } | undefined = undefined

    if(billingAlertEnabled) {
        if(!billingAlertLimit) {
            throw new Error("billingAlertLimit is required when billingAlertEnabled is true")
        }
        if(!billingAlertNotificationEmail) {
            throw new Error("billingAlertNotificationEmail is required when billingAlertEnabled is true")
        }

        billingAlert = {
            limit: billingAlertLimit,
            notificationEmail: billingAlertNotificationEmail
        }
    }

    const instance = new CloudyPadEC2Instance(instanceName, {
        ami: amiId,
        type: instanceType,
        availabilityZone: zone,
        publicKeyContent: publicKeyContent,
        rootVolume: {
            type: "gp3",
            encrypted: true,
            sizeGb: rootVolumeSizeGB
        },
        publicIpType: publicIpType,
        ignorePublicKeyChanges: true,
        spot: {
            enabled: useSpot
        },
        billingAlert: billingAlert,
        dataDisk: dataDisk,
        instanceServerState: instanceServerState,
        ingressPorts: ingressPorts.map(p => ({
            fromPort: p.port, 
            toPort: p.port, 
            protocol: p.protocol, 
            cidrBlocks: ["0.0.0.0/0"],
            ipv6CidrBlocks: ["::/0"]
        }))
    })

    return {
        instanceId: instance.instanceId,
        publicIp: instance.publicIp,
        rootDiskId: instance.rootVolumeId,
        dataDiskId: instance.dataDiskId
    }

}

export interface PulumiStackConfigAws {
    region: string
    zone?: string
    instanceType: string
    rootVolumeSizeGB: number
    publicSshKeyContent: string
    publicIpType: PUBLIC_IP_TYPE
    useSpot: boolean
    imageId?: string
    instanceServerState?: "present" | "absent"
    dataDisk?: {
        state: "present" | "absent"
        sizeGb: number
        snapshotId?: string
    }
    billingAlert?: {
        limit: number
        notificationEmail: string
    },
    ingressPorts: SimplePortDefinition[]
}

export interface AwsPulumiOutput {

    /**
     * ID of the instance server on AWS.
     */
    instanceId?: string

    /**
     * Public IP address of the instance server.
     */
    publicIp: string

    /**
     * ID of the root disk volume on AWS.
     */
    rootDiskId?: string
    
    /**
     * ID of the data disk volume on AWS.
     */
    dataDiskId?: string
}

export interface AwsPulumiClientArgs {
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}
    
export class AwsPulumiClient extends InstancePulumiClient<PulumiStackConfigAws, AwsPulumiOutput> {

    constructor(args: AwsPulumiClientArgs){
        super({ 
            program: awsPulumiProgram, 
            projectName: "CloudyPad-AWS", 
            stackName: args.stackName,
            workspaceOptions: args.workspaceOptions
        })
    }

    async doSetConfig(config: PulumiStackConfigAws){
        this.logger.debug(`Setting stack ${this.stackName} config: ${JSON.stringify(config)}`)

        const stack = await this.getStack()
        await stack.setConfig("aws:region", { value: config.region})
        await stack.setConfig("instanceType", { value: config.instanceType})
        await stack.setConfig("rootVolumeSizeGB", { value: config.rootVolumeSizeGB.toString()})
        await stack.setConfig("publicSshKeyContent", { value: config.publicSshKeyContent})
        await stack.setConfig("publicIpType", { value: config.publicIpType})
        await stack.setConfig("useSpot", { value: config.useSpot.toString()})
        await stack.setConfig("ingressPorts", { value: JSON.stringify(config.ingressPorts)})

        if(config.zone) await stack.setConfig("zone", { value: config.zone})
        if(config.imageId) await stack.setConfig("imageId", { value: config.imageId})
        if(config.instanceServerState) await stack.setConfig("instanceServerState", { value: config.instanceServerState})
        if(config.dataDisk) await stack.setConfig("dataDisk", { value: JSON.stringify(config.dataDisk)})

        if(config.billingAlert){
            await stack.setConfig("billingAlertEnabled", { value: "true"})
            await stack.setConfig("billingAlertLimit", { value: config.billingAlert.limit.toString()})
            await stack.setConfig("billingAlertNotificationEmail", { value: config.billingAlert.notificationEmail})
        } else {
            await stack.setConfig("billingAlertEnabled", { value: "false"})
        }

        const allConfs = await stack.getAllConfig()
        this.logger.debug(`Config after update: ${JSON.stringify(allConfs)}`)

    }

    protected async buildTypedOutput(outputs: OutputMap) : Promise<AwsPulumiOutput>{
        return {
            instanceId: outputs["instanceId"]?.value as string | undefined, // TODO validate with Zod
            publicIp: outputs["publicIp"]?.value || "" as string,
            rootDiskId: outputs["rootDiskId"]?.value as string | undefined,
            dataDiskId: outputs["dataDiskId"]?.value as string | undefined
        }   
    }

}