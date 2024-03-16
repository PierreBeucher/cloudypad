import * as pulumi from "@pulumi/pulumi";
import { CompositeEC2Instance, CompositeEC2InstanceArgs } from "../components/aws/ec2.js";
import { PortDefinition } from "../components/security.js";

/**
 * Wolf ports
 * See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
 */
export const WOLF_PORTS : PortDefinition[] = [
    { from: 47984, protocol: "tcp" },  // HTTP
    { from: 47989, protocol: "tcp" }, // HTTPS
    { from: 48010, protocol: "tcp" }, // RTSP
    { from: 47999, protocol: "udp" }, // Control
    { from: 48100, to: 48110, protocol: "udp" }, // Video (up to 10 users)
    { from: 48200, to: 48210, protocol: "udp" }, // Audio (up to 10 users)
]

export interface WolfInstanceArgs {
    publicSshKey: string
    nixosAmi: string
    fqdn?: string
    instanceArgs?: Omit<CompositeEC2InstanceArgs, "instance.type" | "instance.publicKey">
}

/**
 * Pulumi inline program for a Wolf AWS EC2 instance
 */
export async function wolfEc2InstanceProgram(name: string, args: WolfInstanceArgs, opts?: pulumi.CustomResourceOptions) {

    const finalArgs : CompositeEC2InstanceArgs = {
        ...{
            instance: {
                type: "g5.xlarge", // TODO pass as client config
                ami: args.nixosAmi,
                publicKey: args.publicSshKey,
                rootVolume: { sizeGb: 150 }, // TODO pass as client config
            }, 
            ingressPorts: WOLF_PORTS.concat({ from: 22, protocol: "tcp" }),
            // volumes: // TODO 
            // dns: // TODO
        },
        ...args.instanceArgs
    }

    const instance = new CompositeEC2Instance(name, finalArgs, opts)

    return pulumi.all([instance.ipAddress, instance.ec2Instance.id]).apply( ([ip, instanceId]) => {
        const o : WolfEC2IntanceStackOutput = {
            ipAddress: ip,
            instanceId: instanceId
        } 
        return o
    })
}

/**
 * Interface for Wolf stack outputs
 */
export interface WolfEC2IntanceStackOutput {
    ipAddress: string
    instanceId: string
}