import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs"

interface SunshineInfraConfig {
    environment: string
    hostedZoneName: string
    fqdn?: string
    ami?: string
    instanceType: string
    publicKey: string
    tags?: {[key: string]: string}
    volumeSize?: number
    volumeType?: string
    additionalVolumes?: AdditionalVolume[]
    vpc?: string,
    subnet?: string
}

interface AdditionalVolume {
    deviceName: string
    az: string,
    type: string
    size: number
    iops: number
    throughput: number
}

const DEFAULT_VOLUME_TYPE = "standard"
const DEFAULT_VOLUME_SIZE = 200
const DEFAULT_TAGS = {}

/**
 * 
 */
class SunshineInfra extends pulumi.ComponentResource {

    eip: aws.ec2.Eip

    instanceId: pulumi.Output<string>

    fqdn: pulumi.Output<string>
    
    constructor(name : string, infraConfig : SunshineInfraConfig, opts? : pulumi.ComponentResourceOptions) {
        super("crafteo:sunshine-aws", name, infraConfig, opts);
        
        const commonTags = {
            ...infraConfig.tags || DEFAULT_TAGS, 
            ...{
                Name: `${name}-${infraConfig.environment}`,
            }
        }

        const volType = infraConfig.volumeType || DEFAULT_VOLUME_TYPE
        const volSize = infraConfig.volumeSize || DEFAULT_VOLUME_SIZE

    
        const sg = new aws.ec2.SecurityGroup(`${name}`, {
            ingress: [
                { fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                // Sunshine ports
                // see https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
                { fromPort: 47984, toPort: 47984, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47989, toPort: 47989, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47990, toPort: 47990, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 48010, toPort: 48010, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47998, toPort: 47998, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 47999, toPort: 47999, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 48000, toPort: 48000, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: 48002, toPort: 48002, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
            ],
            egress: [{
                fromPort: 0,
                toPort: 0,
                protocol: "-1",
                cidrBlocks: ["0.0.0.0/0"],
                ipv6CidrBlocks: ["::/0"],
            }],
            tags: commonTags,
            vpcId: infraConfig.vpc,
        }, {
            parent: this
        });

        const keyPair = new aws.ec2.KeyPair(`keypair-${name}`, {
            publicKey: infraConfig.publicKey,
            tags: { Name: name}
        }, {
            parent: this
        })

        // Use NixOS AMI for current region if no specific AMI provided
        const ami = infraConfig.ami ? infraConfig.ami : aws.ec2.getAmi({
            mostRecent: true,
            filters: [
                {
                    name: "name",
                    values: ["NixOS-23.05.555.52869451b83-x86_64-linux"],
                },
                {
                    name: "virtualization-type",
                    values: ["hvm"],
                },
            ],
            owners: ["080433136561"],
        }).then(amiResult => amiResult.id);

        const ec2Instance = new aws.ec2.Instance(`ec2Instance-${name}`, {
            ami: ami,
            instanceType: infraConfig.instanceType,
            tags: commonTags,
            volumeTags: commonTags,
            vpcSecurityGroupIds: [sg.id],
            keyName: keyPair.keyName,
            rootBlockDevice: {
                encrypted: true,
                volumeSize: volSize,
                volumeType: volType
            },
            subnetId: infraConfig.subnet,
            associatePublicIpAddress: true
        }, {
            parent: this
        });

        for (const volConf of infraConfig.additionalVolumes || []) {
            const vol = new aws.ebs.Volume(`additional-vol-${volConf.deviceName}`, {
                encrypted: true,
                availabilityZone: volConf.az,
                size: volConf.size,
                type: volConf.type,
                iops: volConf.throughput,
                throughput: volConf.throughput,
                tags: commonTags
            });

            const volAtt = new aws.ec2.VolumeAttachment(`additional-vol-attach-${volConf.deviceName}`, {
                deviceName: volConf.deviceName,
                volumeId: vol.id,
                instanceId: ec2Instance.id,
            });
        }

        this.instanceId = ec2Instance.id

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

        // Set fqdn attribute to Route53 if defined 
        // Otherwise use auto-generated instance fqdn
        if (infraConfig.fqdn) {
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

            this.fqdn = pulumi.output(infraConfig.fqdn)
        } else {
            this.fqdn = pulumi.output(ec2Instance.publicDns)
        }
    }
}

const config = new pulumi.Config();
const awsConfig = new pulumi.Config("aws");

export const awsRegion = awsConfig.get("region")

const infra = new SunshineInfra("sunshine", {
    environment: config.require("environment"),
    hostedZoneName: config.require("hostedZoneName"),
    fqdn: config.get("fqdn"),
    ami: config.get("ami"),
    instanceType: config.require("instanceType"),
    publicKey: config.require("publicKey"),
    tags: config.getObject("tags"),
    volumeSize: config.getObject<number>("volumeSize"),
    volumeType: config.get("volumeType"),
    additionalVolumes: config.getObject<AdditionalVolume[]>("additionalVolumes"),
    vpc: config.get("vpc"),
    subnet: config.get("subnet"),
})

export const ipAddress = infra.eip.publicIp

export const ip = infra.eip.publicIp
export const fqdn = infra.fqdn
export const ec2InstanceId = infra.instanceId