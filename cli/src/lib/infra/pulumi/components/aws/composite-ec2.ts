import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { PortDefinition } from "../security.js";

export interface InstanceArgs {
    ami: pulumi.Input<string>;
    type: pulumi.Input<string>;
    availabilityZone?: pulumi.Input<string>;
    staticIpEnable?: pulumi.Input<boolean>;
    rootVolume?: {
        sizeGb?: pulumi.Input<number>;
        type?: pulumi.Input<string>;
        encrypted?: pulumi.Input<boolean>;
    }
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

export interface DnsArgs {
    zoneName?: pulumi.Input<string>;
    zoneId?: pulumi.Input<string>;
    prefix?: pulumi.Input<string>;
    ttl?: pulumi.Input<number>;
    type?: pulumi.Input<string>;
}

export interface NetworkArgs {
    vpcId?: pulumi.Input<string>;
    subnetId?: pulumi.Input<string>;
    ingressPorts?: PortDefinition[];
}

export interface CompositeEC2InstanceArgs {
    publicKey: pulumi.Input<string>
    instance: InstanceArgs;
    volumes?: VolumeArgs[];
    dns?: DnsArgs;
    network?: NetworkArgs;
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * A modular EC2 instance with features:
 * - Public IP and DNS record
 * - Volume(s) attachment
 * - Security Groups
 */
export class CompositeEC2Instance extends pulumi.ComponentResource {

    readonly instanceVolumesEIP: EC2InstanceVolumesEIP

    constructor(name : string, args: CompositeEC2InstanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudybox:aws:composite-ec2-instance", name, args, opts);

        const resourceBasename = `composite-ec2-instance-${name}`
    
        // Tags to associate each resources if applicable
        const resourceTags = {
            Name: `CloudyBox-${name}`,
            CloudyBox: name,
            ...args.tags
        }

        const sg = new aws.ec2.SecurityGroup(`${resourceBasename}-sg`, {
            vpcId: args.network?.vpcId,
            ingress: args.network?.ingressPorts?.map(p => {
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
            tags: resourceTags
        }, {
            parent: this
        });

        const keyPair = new aws.ec2.KeyPair(`${resourceBasename}-keypair`, {
            publicKey: args.publicKey,
        }, {
            parent: this
        })

        const ec2InstanceVolumesEIP = new EC2InstanceVolumesEIP(`${resourceBasename}-instance`, {
            keyPairName: keyPair.keyName,
            instance: args.instance,
            tags: resourceTags,
            enableEIP: args.instance.staticIpEnable,
            subnetId: args.network?.subnetId,
            volumes: args.volumes,
            securityGoups: [ sg.id ]
        })

        if (args.dns) {
    
            if (args.dns && !args.dns.zoneId && !args.dns.zoneName){
                throw new Error("If dns if set, either dns.zoneId or dns.zoneName must be set.")
            }
    
            const zone = args.dns.zoneId ? 
                pulumi.output(args.dns.zoneId).apply(zid => aws.route53.getZone({ zoneId: zid }))
            :
                pulumi.output(args.dns.zoneName).apply(zn => aws.route53.getZone({ name: zn })) 
           
            new aws.route53.Record(`${resourceBasename}-dns-record`, {
                zoneId: zone.id,
                name: args.dns.prefix ? pulumi.interpolate`${args.dns.prefix}.${zone.name}` : zone.name,
                type: args.dns.type || "A",
                ttl: args.dns.ttl || 60,
                records: [ec2InstanceVolumesEIP.publicIp],
            }, {
                parent: this
            });
        }

        this.instanceVolumesEIP = ec2InstanceVolumesEIP
        
    }
}

export interface EC2InstanceVolumesEIPArgs {
    instance: InstanceArgs;
    volumes?: VolumeArgs[];
    subnetId?: pulumi.Input<string>
    enableEIP?: pulumi.Input<boolean>
    securityGoups: pulumi.Input<string>[]
    keyPairName: pulumi.Input<string>
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>;
}

/**
 * Very original name for an EC2 instance with Volume and EIP
 */
export class EC2InstanceVolumesEIP extends pulumi.ComponentResource {

    readonly instance: aws.ec2.Instance
    readonly eip?: aws.ec2.Eip
    readonly volumes: aws.ebs.Volume[]

    /**
     * Instance public IP. If EIP is defined, value will be EIP PublicIP
     * Otherwise, use instance PublicIP attribute. 
     */
    readonly publicIp: pulumi.Output<string>

    constructor(name : string, args: EC2InstanceVolumesEIPArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudybox:aws:ec2-instance-volumes-eip", name, args, opts);
        
        const commonOpts : pulumi.ComponentResourceOptions = {
            ...opts,
            parent: this,
        }

        const ec2Instance = new aws.ec2.Instance(`${name}`, {
            ami: args.instance.ami,
            instanceType: args.instance.type,
            availabilityZone: args.instance.availabilityZone,
            tags: args.tags,
            volumeTags: args.tags,
            vpcSecurityGroupIds: args.securityGoups,
            keyName: args.keyPairName,
            rootBlockDevice: {
                encrypted:  args.instance.rootVolume?.encrypted || true,
                volumeSize: args.instance.rootVolume?.sizeGb,
                volumeType: args.instance.rootVolume?.type
            },
            subnetId: args.subnetId,
            associatePublicIpAddress: true,
        }, commonOpts);
    
        
        const volumes = args.volumes?.map(v => {        
            const vol = new aws.ebs.Volume(`${name}-volume-${v.deviceName}`, {
                encrypted: v.encrypted || true,
                availabilityZone: v.availabilityZone || ec2Instance.availabilityZone,
                size: v.size,
                type: v.type,
                iops: v.iops,
                throughput: v.throughput,
                tags: args.tags
            }, commonOpts);
    
            new aws.ec2.VolumeAttachment(`${name}-volume-attach-${v.deviceName}`, {
                deviceName: v.deviceName,
                volumeId: vol.id,
                instanceId: ec2Instance.id,
            }, commonOpts);

            return vol
        })
        
        let eip = undefined

        if (args.enableEIP) {
            eip = new aws.ec2.Eip(`${name}-eip`, {
                tags: args.tags
            }, commonOpts);
                    
            new aws.ec2.EipAssociation(`${name}-eipAssoc`, {
                instanceId: ec2Instance.id,
                allocationId: eip.id,
            }, commonOpts);
        }
    
        this.volumes = volumes ? volumes : []
        this.eip = eip
        this.instance = ec2Instance
        this.publicIp = eip?.publicIp || ec2Instance.publicIp
    }
    
}