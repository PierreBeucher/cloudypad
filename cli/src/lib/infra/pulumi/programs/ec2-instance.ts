import * as pulumi from "@pulumi/pulumi";
import { CompositeEC2Instance, CompositeEC2InstanceArgs } from "../components/aws/ec2.js";

export interface CompositeEC2IntanceStackOutput {
    ipAddress: string
    id: string
}

/**
 * Pulumi inline program for a Wolf AWS EC2 instance
 */
export async function ec2InstanceProgram(name: string, args: CompositeEC2InstanceArgs, opts?: pulumi.CustomResourceOptions) {

    const instance = new CompositeEC2Instance(name, args, opts)

    return pulumi.all([instance.ipAddress, instance.ec2Instance.id]).apply( ([ip, instanceId]) => {
        const o : CompositeEC2IntanceStackOutput = {
            ipAddress: ip,
            id: instanceId
        } 
        return o
    })    
}

