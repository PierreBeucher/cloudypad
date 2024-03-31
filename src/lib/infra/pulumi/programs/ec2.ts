import * as pulumi from "@pulumi/pulumi";
import { ReplicatedEC2instance, ReplicatedEC2instanceArgs } from "../components/aws/replicated-ec2.js";
import { OutputMap } from "@pulumi/pulumi/automation/stack.js";

export interface ReplicatedEC2InstanceFunctionOutputs {
    replicas: {
        ipAddress: string
        instanceId: string
        fqdn?: string
    }[]
}

export function replicatedEC2InstanceProgramFunction(name: string, args: ReplicatedEC2instanceArgs, 
        opts?: pulumi.CustomResourceOptions)  {

    const replicasResource = new ReplicatedEC2instance(name, args, opts)

    const replicaOuput = replicasResource.replicas.map(replica => {

        return pulumi.all([
            replica.instanceVolumesEIP.publicIp, 
            replica.instanceVolumesEIP.instance.id,
            replica.fqdn
        ]).apply( ([ip, instanceId, fqdn]) => {
            return {
                ipAddress: ip,
                instanceId: instanceId,
                fqdn: fqdn
            } 
        })
    })

    return {
        replicas: replicaOuput
    }
}

export function replicatedEC2InstanceOutputs(o: OutputMap) : ReplicatedEC2InstanceFunctionOutputs{
    return {
        replicas: o["replicas"].value
    }
}