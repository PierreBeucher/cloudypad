import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface PortDefinition {
    from: pulumi.Input<number>,
    to?: pulumi.Input<number>,
    protocol?: pulumi.Input<string>,
    cidrBlocks?: pulumi.Input<string>[]
    ipv6CirdBlocks?: pulumi.Input<string>[]
}

export interface CompositeEC2InstanceArgs {

    instance: {
        ami: pulumi.Input<string>
        type: pulumi.Input<string>
        publicKey: pulumi.Input<string>
        rootVolume?: {
            sizeGb?: pulumi.Input<number>
            type?: pulumi.Input<string>
            encrypted?: pulumi.Input<boolean>
        }
    }

    volumes?: {
        size: pulumi.Input<number>
        type?: pulumi.Input<string>
        deviceName: string
        encrypted: pulumi.Input<boolean>
        availabilityZone: pulumi.Input<string>
        iops: pulumi.Input<number>
        throughput: pulumi.Input<number>
    }[]

    ingressPorts?: PortDefinition[]

    dns?: {
        zoneName?: pulumi.Input<string>
        zoneId?: pulumi.Input<string>
        records?: {
            fqdn: pulumi.Input<string>
            ttl: pulumi.Input<number>
            type: pulumi.Input<string>
        }[]
    }

    network?: {
        vpcId?: pulumi.Input<string>
        subnetId?: pulumi.Input<string>
        staticIpEnable: pulumi.Input<boolean>
    }

    tags?: pulumi.Input<{
        [key: string]: pulumi.Input<string>
    }>
}

/**
 * A modular EC2 instance with features:
 * - Public IP and DNS record
 * - Volume(s) attachment
 * - Security Groups
 */
export class CompositeEC2Instance extends pulumi.ComponentResource {

    ipAddress: pulumi.Output<string>

    // instanceId: pulumi.Output<string>

    // fqdn: pulumi.Output<string>
    
    constructor(name : string, args: CompositeEC2InstanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudybox:aws:composite-ec2-instance", name, args, opts);

        const resourceBasename = `composite-ec2-instance`
    
        // Tags to associate each resources if applicable
        const resourceTags = {
            ...{
                Name: `CloudyBox-${name}`,
                CloudyBox: name
            },
            ...args.tags
        }

        const sg = new aws.ec2.SecurityGroup(`${resourceBasename}-sg`, {
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
            tags: resourceTags
        }, {
            parent: this
        });

        const keyPair = new aws.ec2.KeyPair(`${resourceBasename}-keypair`, {
            publicKey: args.instance.publicKey,
        }, {
            parent: this
        })

        const ec2Instance = new aws.ec2.Instance(`${resourceBasename}`, {
            ami: args.instance.ami,
            instanceType: args.instance.type,
            tags: resourceTags,
            volumeTags: resourceTags,
            vpcSecurityGroupIds: [sg.id],
            keyName: keyPair.keyName,
            rootBlockDevice: {
                encrypted:  args.instance.rootVolume?.encrypted || true,
                volumeSize: args.instance.rootVolume?.sizeGb,
                volumeType: args.instance.rootVolume?.type
            },
            subnetId: args.network?.subnetId,
            associatePublicIpAddress: true,
        }, {
            parent: this
        });

        args.volumes?.forEach(v => {
            const vol = new aws.ebs.Volume(`${resourceBasename}-volume-${v.deviceName}`, {
                encrypted: v.encrypted || true,
                availabilityZone: v.availabilityZone,
                size: v.size,
                type: v.type,
                iops: v.iops,
                throughput: v.throughput,
                tags: resourceTags
            });

            new aws.ec2.VolumeAttachment(`${resourceBasename}-volume-attach-${v.deviceName}`, {
                deviceName: v.deviceName,
                volumeId: vol.id,
                instanceId: ec2Instance.id,
            });
        })

        if (args.network?.staticIpEnable) {
            const eip = new aws.ec2.Eip(`${resourceBasename}-eip`, {
                tags: resourceTags
            }, {
                parent: this
            });
                    
            new aws.ec2.EipAssociation(`${resourceBasename}-eipAssoc`, {
                instanceId: ec2Instance.id,
                allocationId: eip.id,
            }, {
                parent: this
            });

            this.ipAddress = eip.publicIp
        } else {
            this.ipAddress = ec2Instance.publicIp
        }

        if (args.dns) {

            if (args.dns && ( !args.dns.zoneId || !args.dns.zoneName)){
                throw new Error("If dns if set, either dns.zoneId or dns.zoneName must be set.")
            }

            const zone = args.dns.zoneId ? 
                pulumi.output(args.dns.zoneId).apply(zid => aws.route53.getZone({ zoneId: zid }))
            :
                pulumi.output(args.dns.zoneName).apply(zn => aws.route53.getZone({ name: zn })) 
           
            // If record array is specified, used them
            // Otherwise use the zone name as FQDN
            if (args.dns.records){
                args.dns.records.forEach(r => {
                    new aws.route53.Record(`${resourceBasename}-dns-record-${r.fqdn}`, {
                        zoneId: zone.id,
                        name: r.fqdn,
                        type: r.type,
                        ttl: r.ttl,
                        records: [this.ipAddress],
                    }, {
                        parent: this
                    });
                })
                
            } else {
                new aws.route53.Record(`${resourceBasename}-dns-record`, {
                    zoneId: zone.id,
                    name: zone.name,
                    type: "A",
                    ttl: 60,
                    records: [this.ipAddress],
                }, {
                    parent: this
                });
            }   
        }
    }
}