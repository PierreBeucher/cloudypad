import { ConfigMap, DestroyResult, InlineProgramArgs, LocalWorkspace, OutputMap, PulumiFn, Stack, StackSummary, UpResult } from "@pulumi/pulumi/automation/index.js"
import * as logging from "../../logging.js"

export interface PulumiBoxManagerArgs {
    stackName: string
    projectName: string
    program: PulumiFn
    config: ConfigMap
}

export interface PulumiStackOutput {
    outputs: OutputMap
}

export class PulumiClient {

    readonly args: PulumiBoxManagerArgs
    
    constructor(box: PulumiBoxManagerArgs) {
        this.args = box
    }

    public async get(): Promise<OutputMap> {
        return await this.doGetStackOutput()
    }

    public async preview(): Promise<string> {
        const res = await this.doPreview()
        return res.stdout
    }

    public async deploy(): Promise<OutputMap> {
        const res = await this.doUp()
        return res.outputs
    }
    
    public async destroy(): Promise<void> {
        await this.doDestroy()
    }

    private async createOrSelectPulumiStackProgram() : Promise<Stack>{
    
        const args: InlineProgramArgs = {
            stackName: this.args.stackName,
            projectName: this.args.projectName,
            program: this.args.program
        };

        const stack = await LocalWorkspace.createOrSelectStack(args);        
        await stack.setAllConfig(this.args.config)
        return stack
    }
    
    private async doGetStackOutput() : Promise<OutputMap>{
        const stack = await this.createOrSelectPulumiStackProgram()
        return stack.outputs()
    }    
    
    private async doUp(): Promise<UpResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        logging.info("   Deploying stack...")
        const upRes = await stack.up({ onOutput: logging.ephemeralInfo, refresh: true });
        logging.ephemeralClear()
        
        logging.info("   Stack deployed !")
    
        return upRes

    }

    private async doPreview() {
        logging.ephemeralInfo(`Preview Pulumi stack ${JSON.stringify(this.args)}`)
        const stack = await this.createOrSelectPulumiStackProgram()
        logging.info("   Previewing stack changes...")
    
        const previewRes = await stack.preview({ onOutput: logging.ephemeralInfo, refresh: true, diff: true })
        logging.ephemeralClear()

        logging.info(previewRes.stdout)
        return previewRes
    }

    private async doDestroy(): Promise<DestroyResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        logging.info("   Destroying stack...")
        const destroyRes = await stack.destroy({ onOutput: logging.ephemeralInfo });
        logging.ephemeralInfo(`   Update summary: \n${JSON.stringify(destroyRes.summary.resourceChanges, null, 4)}`);
        logging.ephemeralClear()

        logging.info("   Stack Destroyed !")
    
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