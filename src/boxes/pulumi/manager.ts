import { PulumiClient } from "../../lib/infra/pulumi/pulumi-client.js";
import { OutputMap } from "@pulumi/pulumi/automation/stack.js";
import { ConfigMap } from "@pulumi/pulumi/automation/config.js";
import { PulumiFn } from "@pulumi/pulumi/automation/workspace.js";
import { BoxOutputs, BoxMetadata, BoxBase, BoxManager } from "../common/base.js";

export interface PulumiBoxManagerArgs  {
    program: PulumiFn
    config: ConfigMap
    meta: BoxMetadata
}

/**
 * A generic box manager using Pulumi. T is an interface matching Pulumi stack output.
 */
export abstract class PulumiBoxManager<T extends BoxOutputs>  extends BoxBase implements BoxManager {

    readonly args: PulumiBoxManagerArgs
    readonly client: PulumiClient

    constructor(args: PulumiBoxManagerArgs) {
        super(args.meta)
        this.args = args
        this.client = new PulumiClient({
            projectName: `CloudyBox-${args.meta.kind}`,
            stackName: args.meta.name,
            config: args.config,
            program: args.program,
        })
    }

    async get() : Promise<T> {
        const o = await this.client.getOutputsRaw()
        return this.stackOuputToBoxOutput(o)
    }  

    public async deploy() : Promise<T> {
        await this.provision()
        return this.configure()
    }

    async provision() : Promise<T> {
        const o = await this.client.up()
        return this.stackOuputToBoxOutput(o.outputs)
    }

    async destroy(){
        await this.client.destroy()
    }

    async preview() {
        const p = await this.client.preview()
        return p.stdout
    }

    async refresh() {
        await this.client.refresh()
        return this.get()
    }

    async configure() : Promise<T> {
        // NO OP
        return this.get()
    }

    async getMetadata(): Promise<BoxMetadata> {
        return this.args.meta
    }

    abstract stackOuputToBoxOutput(o: OutputMap): Promise<T>

    abstract stop(): Promise<void>
    abstract start(): Promise<void>
    abstract restart(): Promise<void>
}