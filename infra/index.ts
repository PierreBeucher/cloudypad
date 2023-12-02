import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs"

interface SunshineInfraConfig {
    environment: string
    hostedZoneName?: string
    fqdn?: string
    ami?: string
    eipEnable?: boolean,
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

    ipAddress: pulumi.Output<string>

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

        const sunshinePort = 47989

        const sg = new aws.ec2.SecurityGroup(`${name}`, {
            ingress: [
                { fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                // Sunshine ports based on default port 47989 and offset -5 to +21
                // see https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
                { fromPort: sunshinePort-5, toPort: sunshinePort-5, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort, toPort: sunshinePort, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+1, toPort: sunshinePort+1, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+21, toPort: sunshinePort+21, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+9, toPort: sunshinePort+9, protocol: "udp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+10, toPort: sunshinePort+10, protocol: "udp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+11, toPort: sunshinePort+11, protocol: "udp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
                { fromPort: sunshinePort+13, toPort: sunshinePort+13, protocol: "udp", cidrBlocks: ["0.0.0.0/0"], ipv6CidrBlocks: ["0.0.0.0/0"] },
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

        // Create and attach EIP if enabled
        // Otherwise use instance generated IP as attribute
        if (infraConfig.eipEnable) {
            const eip = new aws.ec2.Eip(`eip-${name}`, {
                tags: commonTags
            }, {
                parent: this
            });
                    
            const eipAssoc = new aws.ec2.EipAssociation(`eipAssoc-${name}`, {
                instanceId: ec2Instance.id,
                allocationId: eip.id,
            }, {
                parent: this
            });

            this.ipAddress = eip.publicIp
        } else {
            this.ipAddress = ec2Instance.publicIp
        }


        // Set fqdn attribute to Route53 if defined 
        // Otherwise use auto-generated instance fqdn
        if (infraConfig.fqdn) {
            if (!infraConfig.hostedZoneName){
                throw new Error("Hosted zone name must be defined if fqdn is defined")
            }

            const hostedZone = aws.route53.getZone({ name: infraConfig.hostedZoneName })
            const hzId = hostedZone.then(hz => hz.id)
    
            // DNS record using Elastic IP
            const dnsRecord = new aws.route53.Record(`dns-record-${name}`, {
                zoneId: hzId,
                name: infraConfig.fqdn,
                type: "A",
                ttl: 30,
                records: [this.ipAddress],
            }, {
                parent: this
            });
    
            const wildcardDnsRecord = new aws.route53.Record(`wildcard-dns-record-${name}`, {
                zoneId: hzId,
                name: `*.${infraConfig.fqdn}`,
                type: "A",
                ttl: 30,
                records: [this.ipAddress],
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

// Read public key file
const sshPublicKeyPath = config.require("sshPublicKeyPath")
const sshPublicKey = fs.readFileSync(sshPublicKeyPath, "utf8")

const infra = new SunshineInfra("sunshine", {
    environment: config.require("environment"),
    hostedZoneName: config.get("hostedZoneName"),
    eipEnable: config.getBoolean("eipEnable"),
    fqdn: config.get("fqdn"),
    ami: config.get("ami"),
    instanceType: config.require("instanceType"),
    publicKey: sshPublicKey,
    tags: config.getObject("tags"),
    volumeSize: config.getObject<number>("volumeSize"),
    volumeType: config.get("volumeType"),
    additionalVolumes: config.getObject<AdditionalVolume[]>("additionalVolumes"),
    vpc: config.get("vpc"),
    subnet: config.get("subnet"),
})

export const ipAddress = infra.ipAddress
export const fqdn = infra.fqdn
export const ec2InstanceId = infra.instanceId
export const sunshineUrl = pulumi.interpolate`https://${infra.fqdn}:47990`