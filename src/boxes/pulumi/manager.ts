import { PulumiClient } from "../../lib/infra/pulumi/pulumi-client.js";
import { OutputMap } from "@pulumi/pulumi/automation/stack.js";
import { ConfigMap } from "@pulumi/pulumi/automation/config.js";
import { PulumiFn } from "@pulumi/pulumi/automation/workspace.js";
import { BoxOutputs, BoxMetadata, BaseBox, ManagerBox } from "../common/base.js";

export interface PulumiManagerBoxArgs  {
    program: PulumiFn
    config: ConfigMap
    meta: BoxMetadata
}

/**
 * A generic box manager using Pulumi. T is an interface matching Pulumi stack output.
 */
export abstract class PulumiManagerBox<T extends BoxOutputs>  extends BaseBox implements ManagerBox {

    readonly args: PulumiManagerBoxArgs
    readonly client: PulumiClient

    constructor(args: PulumiManagerBoxArgs) {
        super(args.meta)
        this.args = args
        this.client = new PulumiClient({
            projectName: `CloudyBox-${args.meta.context}`,
            stackName: args.meta.name,
            config: args.config,
            program: args.program,
        })
    }

    async get() : Promise<T> {
        const o = await this.client.getOutputsRaw()
        this.logger.info(`Got box details: ${JSON.stringify(o)}`)
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