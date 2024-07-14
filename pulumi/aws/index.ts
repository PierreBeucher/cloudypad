import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface PortDefinition {
    from: pulumi.Input<number>,
    to?: pulumi.Input<number>,
    protocol?: pulumi.Input<string>,
    cidrBlocks?: pulumi.Input<string>[]
    ipv6CirdBlocks?: pulumi.Input<string>[]
}

export interface VolumeArgs {
    size: pulumi.Input<number>;
    type?: pulumi.Input<string>;
    deviceName: string;
    encrypted?: pulumi.Input<boolean>;
    availabilityZone?: pulumi.Input<string>;
    iops?: pulumi.Input<number>;
    throughput?: pulumi.Input<number>;
}

export interface CloudyPadEC2instanceArgs {
    vpcId?: pulumi.Input<string>;
    subnetId?: pulumi.Input<string>;
    ingressPorts?: PortDefinition[];
    publicKey: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    ami: pulumi.Input<string>;
    type: pulumi.Input<string>;
    publicIpType?: pulumi.Input<string>;
    rootVolume?: {
        sizeGb?: pulumi.Input<number>;
        type?: pulumi.Input<string>;
        encrypted?: pulumi.Input<boolean>;
    }
    additionalVolumes?: VolumeArgs[]

    /**
     * Ignore changes to public key used to create instance.
     * This allow to pass any value to public key without destroying instance
     */
    ignorePublicKeyChanges?: pulumi.Input<boolean>
}

/**
 * Multiple replicas of CompositeEC2Instance
 */
export class CloudyPadEC2Instance extends pulumi.ComponentResource {
    
    readonly ec2Instance: aws.ec2.Instance
    readonly volumes: aws.ebs.Volume[]
    readonly keypair: aws.ec2.KeyPair
    readonly securityGroup: aws.ec2.SecurityGroup
    readonly eip?: aws.ec2.Eip

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

        this.securityGroup = new aws.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: args.vpcId,
            ingress: args.ingressPorts?.map(p => {
                return { 
                    fromPort: p.from, 
                    toPort: p.to || p.from, 
                    protocol: p.protocol || "all", 
                    cidrBlocks: p.cidrBlocks || ["0.0.0.0/0"],
                    ipv6CidrBlocks: p.ipv6CirdBlocks || ["::/0"]
                }
            }),
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

        this.keypair = new aws.ec2.KeyPair(`${name}-keypair`, {
            publicKey: args.publicKey,
            keyName: awsResourceNamePrefix
        }, {
            ...commonPulumiOpts,
            ignoreChanges: args.ignorePublicKeyChanges ? [ "publicKey" ] : []
        })

        this.ec2Instance = new aws.ec2.Instance(`${name}-ec2-instance`, {
            ami: args.ami,
            instanceType: args.type,
            tags:  {
                ...args.tags,
                Name: awsResourceNamePrefix
            },
            volumeTags: args.tags,
            vpcSecurityGroupIds: [this.securityGroup.id],
            keyName: this.keypair.keyName,
            rootBlockDevice: {
                encrypted:  args.rootVolume?.encrypted || true,
                volumeSize: args.rootVolume?.sizeGb,
                volumeType: args.rootVolume?.type
            },
            subnetId: args.subnetId,
            associatePublicIpAddress: true,
        }, {
            ...commonPulumiOpts,
            ignoreChanges: [
                "associatePublicIpAddress" 
            ]
        })

        this.volumes = []
        args.additionalVolumes?.forEach(v => {        
            const vol = new aws.ebs.Volume(`${name}-volume-${v.deviceName}`, {
                encrypted: v.encrypted || true,
                availabilityZone: v.availabilityZone || this.ec2Instance.availabilityZone,
                size: v.size,
                type: v.type,
                iops: v.iops,
                throughput: v.throughput,
                tags: globalTags
            }, commonPulumiOpts);
    
            new aws.ec2.VolumeAttachment(`${name}-volume-attach-${v.deviceName}`, {
                deviceName: v.deviceName,
                volumeId: vol.id,
                instanceId: this.ec2Instance.id,
            }, commonPulumiOpts);

            this.volumes.push(vol)
        })
        

        if (args.publicIpType === "static") {
            this.eip = new aws.ec2.Eip(`${name}-eip`, {
                tags: globalTags
            }, commonPulumiOpts);
                    
            new aws.ec2.EipAssociation(`${name}-eipAssoc`, {
                instanceId: this.ec2Instance.id,
                allocationId: this.eip.id,
            }, commonPulumiOpts);
        } else if (args.publicIpType !== "dynamic") {
            throw "publicIpType must be either 'static' or 'dynamic'"
        }

    }
}

const config = new pulumi.Config();
const instanceType = config.require("instanceType");
const sshPublicKeyValue = config.require("sshPublicKeyValue");
const rootVolumeSizeGB = config.requireNumber("rootVolumeSizeGB");
const publicIpType = config.require("publicIpType");
const instanceName = pulumi.getStack()

pulumi.log.info(`Stack name: ${instanceName}`)

const ubuntuAmi = aws.ec2.getAmiOutput({
    mostRecent: true,
    filters: [
        {
            name: "name",
            values: ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"],
        },
        {
            name: "virtualization-type",
            values: ["hvm"],
        },
    ],
    owners: ["099720109477"],
})


const instance = new CloudyPadEC2Instance(instanceName, {
    ami: ubuntuAmi.imageId,
    type: instanceType,
    publicKey: sshPublicKeyValue,
    rootVolume: {
        type: "gp3",
        encrypted: true,
        sizeGb: rootVolumeSizeGB
    },
    publicIpType: publicIpType,
    ignorePublicKeyChanges: true,
    ingressPorts: [ // SSH + Wolf ports
        { from: 22, protocol: "tcp" }, // HTTP
        { from: 47984, protocol: "tcp" }, // HTTP
        { from: 47989, protocol: "tcp" }, // HTTPS
        { from: 48010, protocol: "tcp" }, // RTSP
        { from: 47999, protocol: "udp" }, // Control
        { from: 48100, to: 48110, protocol: "udp" }, // Video (up to 10 users)
        { from: 48200, to: 48210, protocol: "udp" }, // Audio (up to 10 users)
    ]
})

export const instanceId = instance.ec2Instance.id