import { ConfigMap, DestroyResult, InlineProgramArgs, LocalWorkspace, OutputMap, PulumiFn, Stack, StackSummary, UpResult } from "@pulumi/pulumi/automation/index.js"
import * as logging from "../lib/logging.js"
import { BoxInput, BoxOutput } from "../lib/core.js"

export interface PulumiBoxInput extends BoxInput {
    projectName: string
    program: PulumiFn
    config: ConfigMap
}

export interface PulumiBoxOutput extends BoxOutput {
    outputs: OutputMap
}

export class PulumiBoxManager {

    readonly boxInput: PulumiBoxInput
    
    constructor(box: PulumiBoxInput) {
        this.boxInput = box
    }

    public async get(): Promise<PulumiBoxOutput> {
        const res = await this.doGetStackOutput()
        return this.buildOutput(res)
    }

    public async preview(): Promise<string> {
        const res =await this.doPreview()
        return res.stdout
    }

    public async deploy(): Promise<PulumiBoxOutput> {
        const res = await this.doUp()
        return this.buildOutput(res.outputs)
    }
    
    public async destroy(): Promise<PulumiBoxOutput> {
        await this.doDestroy()
        return this.buildOutput({})
    }
    
    public async start(): Promise<PulumiBoxOutput> {
        throw new Error("Method not implemented.")
    }
    
    public async stop(): Promise<PulumiBoxOutput> {
        throw new Error("Method not implemented.")
    }

    private buildOutput(outputs: OutputMap) : PulumiBoxOutput{
        return { outputs: outputs }
    }

    private async createOrSelectPulumiStackProgram() : Promise<Stack>{
    
        const args: InlineProgramArgs = {
            stackName: this.boxInput.name,
            projectName: this.boxInput.projectName,
            program: this.boxInput.program
        };

        const stack = await LocalWorkspace.createOrSelectStack(args);        
        await stack.setAllConfig(this.boxInput.config)
        return stack
    }
    
    private async doGetStackOutput() : Promise<OutputMap>{
        const stack = await this.createOrSelectPulumiStackProgram()
        return stack.outputs()
    }    
    
    private async doUp(): Promise<UpResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        console.info("   Deploying stack...")
        const upRes = await stack.up({ onOutput: logging.ephemeralInfo, refresh: true });
        logging.ephemeralClear()
        
        console.info("   Stack deployed !")
    
        return upRes

    }

    private async doPreview() {
        console.debug(`Preview Pulumi stack ${JSON.stringify(this.boxInput)}`)
        const stack = await this.createOrSelectPulumiStackProgram()
        console.info("   Previewing stack changes...")
    
        const previewRes = await stack.preview({ onOutput: logging.ephemeralInfo, refresh: true, diff: true })
        logging.ephemeralClear()

        console.info(previewRes.stdout)
        return previewRes
    }

    private async doDestroy(): Promise<DestroyResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        console.info("   Destroying stack...")
        const destroyRes = await stack.destroy({ onOutput: logging.ephemeralInfo });
        logging.ephemeralClear()
        
        console.info("   Stack Destroyed !")
        console.log(`   Update summary: \n${JSON.stringify(destroyRes.summary.resourceChanges, null, 4)}`);
    
        return destroyRes

    }

}

export async function list(project: string) : Promise<StackSummary[]>{

    const w = LocalWorkspace.create({projectSettings: {
        name: project,
        runtime: "nodejs"
    }})

    const stacks = w.then(w => w.listStacks())

    return stacks
}