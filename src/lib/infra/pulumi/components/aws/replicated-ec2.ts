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

export interface ReplicatedEC2instanceArgs {
    publicKey: pulumi.Input<string>
    network?: NetworkArgs
    dns?: DnsArgs
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>
    replicas?: string[] | number
    instance: InstanceArgs
    volumes?: VolumeArgs[]

    /**
     * Ignore changes to public key used to create instance.
     * This allow to pass any value to public key without destroying instance
     */
    ignorePublicKeyChanges?: pulumi.Input<boolean>
}

export interface EC2instanceResult {
    name: string
    instance: aws.ec2.Instance
    publicIp: pulumi.Output<string>
    volumes?: aws.ebs.Volume[]
    fqdn?: pulumi.Output<string>
}

/**
 * Multiple replicas of CompositeEC2Instance
 */
export class ReplicatedEC2instance extends pulumi.ComponentResource {
    
    readonly replicas: EC2instanceResult[]

    constructor(name: string, args: ReplicatedEC2instanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudybox:aws:replicated-ec2-instance", name, args, opts);

        const pulumiResourceName = `replicated-ec2-instance-${name}`

        const resourceNameTagBase = `CloudyBox-${name}`

        const globalTags = {
            ...args.tags,
            Name: resourceNameTagBase,
        }

        const commonPulumiOpts = {
            parent: this
        }

        const sg = new aws.ec2.SecurityGroup(`${pulumiResourceName}-sg`, {
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
            tags: globalTags
        }, commonPulumiOpts);

        const keyPair = new aws.ec2.KeyPair(`${pulumiResourceName}-keypair`, {
            publicKey: args.publicKey,
        }, {
            ...commonPulumiOpts,
            ignoreChanges: args.ignorePublicKeyChanges ? [ "publicKey" ] : []
        })

        const replicaNames = this.computeReplicaNames(args.replicas)
        const replicas : EC2instanceResult[] = replicaNames.map(rname => {

            const perReplicaTags = {
                ...args.tags,
                Name: `${resourceNameTagBase}-${rname}`
            }
            const perReplicaPulumiResourceName = `${pulumiResourceName}-${rname}`

            const ec2Instance = new aws.ec2.Instance(`${perReplicaPulumiResourceName}`, {
                ami: args.instance.ami,
                instanceType: args.instance.type,
                availabilityZone: args.instance.availabilityZone,
                tags: perReplicaTags,
                volumeTags: args.tags,
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
                ...commonPulumiOpts,
                ignoreChanges: [
                    "associatePublicIpAddress" 
                ]
            });
        

            const volumes = args.volumes?.map(v => {        
                const vol = new aws.ebs.Volume(`${perReplicaPulumiResourceName}-volume-${v.deviceName}`, {
                    encrypted: v.encrypted || true,
                    availabilityZone: v.availabilityZone || ec2Instance.availabilityZone,
                    size: v.size,
                    type: v.type,
                    iops: v.iops,
                    throughput: v.throughput,
                    tags: args.tags
                }, commonPulumiOpts);
        
                new aws.ec2.VolumeAttachment(`${perReplicaPulumiResourceName}-volume-attach-${v.deviceName}`, {
                    deviceName: v.deviceName,
                    volumeId: vol.id,
                    instanceId: ec2Instance.id,
                }, commonPulumiOpts);
    
                return vol
            })
            
            let eip: aws.ec2.Eip | undefined = undefined
            
            if (args.instance.staticIpEnable) {
                eip = new aws.ec2.Eip(`${perReplicaPulumiResourceName}-eip`, {
                    tags: args.tags
                }, commonPulumiOpts);
                        
                new aws.ec2.EipAssociation(`${perReplicaPulumiResourceName}-eipAssoc`, {
                    instanceId: ec2Instance.id,
                    allocationId: eip.id,
                }, commonPulumiOpts);
            }

            const result: EC2instanceResult = {
                name: rname,
                instance: ec2Instance,
                volumes: volumes,
                publicIp: eip?.publicIp || ec2Instance.publicIp
            }

            return result
        })

        if (args.dns) {
            
            if (!args.dns.zoneId && !args.dns.zoneName){
                throw new Error("If dns if set, either dns.zoneId or dns.zoneName must be set.")
            }

            const dnsZone = args.dns.zoneId ? 
                pulumi.output(args.dns.zoneId).apply(zid => aws.route53.getZone({ zoneId: zid }))
            :
                pulumi.output(args.dns.zoneName).apply(zn => aws.route53.getZone({ name: zn })) 

            // Record suffix shared by all instances. For zone example.com:
            // - If no prefix given, records will looke like <replicaName>.example.com
            // - With prefix, records will looke like <replicaName>.prefix.example.com
            const fqdnSuffix = args.dns.prefix ? pulumi.interpolate`${args.dns.prefix}.${dnsZone.name}` : dnsZone.name
            
            // Generate record such as <replicaName>.[prefix.]example.com
            // eg. instance1.subdomain.example.com
            for(const r of replicas){

                const fqdn = pulumi.interpolate`${r.name}.${fqdnSuffix}`
                
                new aws.route53.Record(`${pulumiResourceName}-${r.name}-dns-record`, {
                    zoneId: dnsZone.id,
                    name: fqdn,
                    type: args.dns.type || "A",
                    ttl: args.dns.ttl || 60,
                    records: [r.publicIp],
                }, {
                    parent: this
                });

                r.fqdn = fqdn
            }

            const allIReplicaIPs = replicas.map(r => r.publicIp)
            
            // do not name "global-dns-record" to avoid potential name conflicts
            // with `${pulumiResourceName}-${r.name}-dns-record`
            new aws.route53.Record(`${pulumiResourceName}-dns-record-global`, { 
                zoneId: dnsZone.id,
                name: fqdnSuffix,
                type: args.dns.type || "A",
                ttl: args.dns.ttl || 60,
                records: allIReplicaIPs,
            }, {
                parent: this
            });

        }

        this.replicas = replicas
    }

    /**
     * Compute replica names 
     * If replicas is not provided, a single "default" replica is created
     * If replicas provided and is number, replicas are named 1 to N
     * If replicas provided and is string[], us it as-is
     */
    private computeReplicaNames(replicas?: number | string[]){
        if (!replicas) return [ "instance" ]

        if (typeof replicas === "number") {
            return [...Array(replicas).keys()].map(k => k.toString())
        }

        return replicas // string[]
    }
}
