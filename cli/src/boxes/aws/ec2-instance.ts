import { ConfigMap } from "@pulumi/pulumi/automation";
import { PulumiClient } from "../../lib/infra/pulumi/pulumi-client.js";
import { ec2InstanceProgram } from "../../lib/infra/pulumi/programs/ec2-instance.js";
import { CompositeEC2InstanceArgs } from "../../lib/infra/pulumi/components/aws/ec2.js";
import { CloudVMBoxManager, outputsFromPulumi } from "../common/cloud-virtual-machine.js";
import { AwsClient } from "../../lib/infra/aws/client.js";
import { BoxMetadata } from "../../lib/core.js";

export interface EC2InstanceBoxArgs {
    name: string,
    aws?: {
        region?: string
    }
    infraArgs: CompositeEC2InstanceArgs
}

export class EC2InstanceBoxManager implements CloudVMBoxManager {
    
    readonly args: EC2InstanceBoxArgs
    readonly pulumiClient: PulumiClient
    readonly awsClient: AwsClient
    readonly meta: BoxMetadata

    constructor(args: EC2InstanceBoxArgs){
        this.meta = new BoxMetadata({ name: args.name, kind: "aws-ec2-instance"})
        this.args = args
        this.pulumiClient = buildPulumiClient(args)
        this.awsClient = new AwsClient({region: args.aws?.region})
    }

    async deploy() {
        const o = await this.pulumiClient.deploy()
        return outputsFromPulumi(o)        
    }
    
    async destroy() {
        return this.pulumiClient.destroy()
    }

    async preview() {
        return this.pulumiClient.preview()    
    }

    async provision() {
        return this.get()
    }

    async get() {
        const o = await this.pulumiClient.get()
        return outputsFromPulumi(o)    
    }

    async stop(){
        const o = await this.get()
        await this.awsClient.stopInstance(o.id)
    }

    async start(){
        const o = await this.get()
        await this.awsClient.startInstance(o.id)
    }

    async restart(){
        const o = await this.get()
        await this.awsClient.rebootInstance(o.id)
    }

    async getMetadata(): Promise<BoxMetadata> {
        return this.meta
    }
}

function buildPulumiClient(args: EC2InstanceBoxArgs) : PulumiClient {

    // TODO generic for AWS stacks ?
    const pulumiConfig : ConfigMap = {}
    if(args.aws?.region) {
        pulumiConfig["aws:region"] = { value: args.aws?.region }
    }

    return new PulumiClient({
        stackName: args.name,
        projectName: `cloudybox-aws-ec2-instance`,
        program: async () => {
            return ec2InstanceProgram(args.name, args.infraArgs)
        },
        config: pulumiConfig
    })
}