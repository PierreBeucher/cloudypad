import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs"

interface SunshineInfraConfig {
    environment: string
    hostedZoneName: string
    fqdn: string
    ami: string
    instanceType: string
    publicKey: string
    tags: {[key: string]: string}
}

/**
 * 
 */
export class SunshineInfra extends pulumi.ComponentResource {

    eip: aws.ec2.Eip;
    
    constructor(name : string, infraConfig : SunshineInfraConfig, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:sunshine-aws", name, infraConfig, opts);
        
        const commonTags = {
            ...infraConfig.tags, 
            ...{
                Name: `${name}-${infraConfig.environment}`,
            }
        }

    
        const sg = new aws.ec2.SecurityGroup(`${name}`, {
            ingress: [
                { fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 80, toPort: 80, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 443, toPort: 443, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47984, toPort: 48010, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47984, toPort: 48010, protocol: "udp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
            ],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
                ipv6CidrBlocks: ["::/0"],
            }],
            tags: commonTags,
        }, {
            parent: this
        });

        const keyPair = new aws.ec2.KeyPair(`keypair-${name}`, {
            publicKey: infraConfig.publicKey,
            tags: { Name: name}
        }, {
            parent: this
        })

        const ec2Instance = new aws.ec2.Instance(`ec2Instance-${name}`, {
            ami: infraConfig.ami,
            instanceType: infraConfig.instanceType,
            tags: commonTags,
            volumeTags: commonTags,
            vpcSecurityGroupIds: [sg.id],
            keyName: keyPair.keyName,
            rootBlockDevice: {
                encrypted: true,
                volumeSize: 40,
                volumeType: "gp3"
            }

        }, {
            parent: this
        });

        this.eip = new aws.ec2.Eip(`eip-${name}`, {
            tags: commonTags
        }, {
            parent: this
        });

        const eipAssoc = new aws.ec2.EipAssociation(`eipAssoc-${name}`, {
            instanceId: ec2Instance.id,
            allocationId: this.eip.id,
        }, {
            parent: this
        });

        const hostedZone = aws.route53.getZone({ name: infraConfig.hostedZoneName })
        const hzId = hostedZone.then(hz => hz.id)

        // DNS record using Elastic IP
        const dnsRecord = new aws.route53.Record(`dns-record-${name}`, {
            zoneId: hzId,
            name: infraConfig.fqdn,
            type: "A",
            ttl: 30,
            records: [this.eip.publicIp],
        }, {
            parent: this
        });

        const wildcardDnsRecord = new aws.route53.Record(`wildcard-dns-record-${name}`, {
            zoneId: hzId,
            name: `*.${infraConfig.fqdn}`,
            type: "A",
            ttl: 30,
            records: [this.eip.publicIp],
        }, {
            parent: this
        });
   
    }
}

const config = new pulumi.Config();

export const fqdn = config.require("fqdn")

export const infra = new SunshineInfra("sunshine", {
    environment: config.require("environment"),
    hostedZoneName: config.require("hostedZoneName"),
    fqdn: fqdn,
    ami: config.require("ami"),
    instanceType: config.require("instanceType"),
    publicKey: config.require("publicKey"),
    tags: config.requireObject("tags"),
})
