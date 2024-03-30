import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { DnsArgs, EC2InstanceVolumesEIP, InstanceArgs, NetworkArgs, VolumeArgs } from "./composite-ec2.js";

//
// Replicated EC2 instance
//

export interface ReplicatedEC2instanceArgs {
    publicKey: pulumi.Input<string>
    network?: NetworkArgs;
    dns?: DnsArgs;
    tags?: pulumi.Input<{ [key: string]: pulumi.Input<string> }>

    replicas: string[] | number

    template: {
        instance: InstanceArgs
        volumes?: VolumeArgs[]
    }
        
}

/**
 * Multiple replicas of CompositeEC2Instance
 */
export class ReplicatedEC2instance extends pulumi.ComponentResource {
    
    readonly replicas: {
        instanceVolumesEIP: EC2InstanceVolumesEIP,
        fqdn?: pulumi.Output<string>,
        name: string
    }[]

    constructor(name : string, args: ReplicatedEC2instanceArgs, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:cloudybox:aws:replicated-ec2-instance", name, args, opts);

        const pulumiResourceName = `replicated-ec2-instance-${name}`

        const resourceNameTagBase = `CloudyBox-${name}`
        const resourceTags = {
            Name: resourceNameTagBase,
            CloudyBox: name,
            ...args.tags
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
            tags: resourceTags
        }, {
            parent: this
        });

        const keyPair = new aws.ec2.KeyPair(`${pulumiResourceName}-keypair`, {
            publicKey: args.publicKey,
        }, {
            parent: this
        })

        // If replicas is number name instance from index,
        // otherwise use provided names. 
        const replicaNames : string[] = typeof args.replicas === "number" ?
            [...Array(args.replicas).keys()].map(k => k.toString())
        : 
            args.replicas


        // Validate DNS config 
        let dnsZone : pulumi.Output<aws.route53.GetZoneResult> | undefined = undefined
        let fqdnSuffix : pulumi.Output<string> | undefined = undefined

        if (args.dns) {

            if (args.dns && !args.dns.zoneId && !args.dns.zoneName){
                throw new Error("If dns if set, either dns.zoneId or dns.zoneName must be set.")
            }
    
            dnsZone = args.dns.zoneId ? 
                pulumi.output(args.dns.zoneId).apply(zid => aws.route53.getZone({ zoneId: zid }))
            :
                pulumi.output(args.dns.zoneName).apply(zn => aws.route53.getZone({ name: zn })) 

            // Record suffix shared by all instances. For zone example.com:
            // - If no prefix given, records will looke like <replicaName>.example.com
            // - With prefix, records will looke like <replicaName>.prefix.example.com
            fqdnSuffix = args.dns.prefix ? pulumi.interpolate`${args.dns.prefix}.${dnsZone.name}` : dnsZone.name
        }

        const replicas = replicaNames.map(rname => {

            const replicaNameTag = `${resourceNameTagBase}-${rname}`

            const ec2InstanceVolumesEIP = new EC2InstanceVolumesEIP(`${pulumiResourceName}-replica-${rname}`, {
                keyPairName: keyPair.keyName,
                instance: args.template.instance,
                tags: {
                    ...resourceTags,
                    Name: replicaNameTag
                },
                enableEIP: args.template.instance.staticIpEnable,
                subnetId: args.network?.subnetId,
                volumes: args.template.volumes,
                securityGoups: [ sg.id ]
            })

            // Generate record such as <replicaName>.[prefix.]example.com
            // eg. instance1.subdomain.example.com
            let fqdn: pulumi.Output<string> | undefined = undefined
            if (args.dns) {

                if (!dnsZone || !fqdnSuffix) {
                    throw new Error("dnsZone or fqdnSuffix is undefined despite dns being enabled. This is probably an internal bug.")
                }
                
                fqdn = pulumi.interpolate`${rname}.${fqdnSuffix}`
                new aws.route53.Record(`${pulumiResourceName}-${rname}-dns-record`, {
                    zoneId: dnsZone.id,
                    name: fqdn,
                    type: args.dns.type || "A",
                    ttl: args.dns.ttl || 60,
                    records: [ec2InstanceVolumesEIP.publicIp],
                }, {
                    parent: this
                });
            }

            return {
                instanceVolumesEIP: ec2InstanceVolumesEIP,
                fqdn: fqdn,
                name: rname
            }
        })

        this.replicas = replicas
        
    }
}
