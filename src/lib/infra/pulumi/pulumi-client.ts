import { ConfigMap, DestroyResult, InlineProgramArgs, LocalWorkspace, OutputMap, PreviewResult, PulumiFn, Stack, StackSummary, UpResult } from "@pulumi/pulumi/automation/index.js"
import * as logging from "../../logging.js"

export interface PulumiClientArgs {
    stackName: string
    projectName: string
    program: PulumiFn
    config: ConfigMap
}

/**
 * A Pulumi client to manage Pulumi programs.
 */
export class PulumiClient {

    readonly args: PulumiClientArgs
    
    constructor(args: PulumiClientArgs) {
        this.args = args
    }

    public async getOutputsRaw(): Promise<OutputMap> {
        return this.doGetStackOutput()
    }

    public async preview(): Promise<PreviewResult> {
        return this.doPreview()
    }

    public async up(): Promise<UpResult> {
        return this.doUp()
    }
    
    public async destroy(): Promise<DestroyResult> {
        return this.doDestroy()
    }

    private async createOrSelectPulumiStackProgram() : Promise<Stack>{
    
        const args: InlineProgramArgs = {
            stackName: this.args.stackName,
            projectName: this.args.projectName,
            program: this.args.program
        };

        const stack = await LocalWorkspace.createOrSelectStack(args);        
        await stack.setAllConfig(this.args.config)

        logging.ephemeralInfo(`Pulumi workdir: ${stack.workspace.workDir}`)
        
        return stack
    }
    
    private async doGetStackOutput() : Promise<OutputMap>{
        const stack = await this.createOrSelectPulumiStackProgram()
        return stack.outputs()
    }    
    
    private async doUp(): Promise<UpResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        logging.info("   Updating stack...")
        const upRes = await stack.up({ onOutput: logging.ephemeralInfo, refresh: true });
        
        logging.info("   Stack updated !")
    
        return upRes
    }

    private async doPreview() : Promise<PreviewResult> {
        logging.ephemeralInfo(`Preview Pulumi stack ${JSON.stringify(this.args)}`)
        const stack = await this.createOrSelectPulumiStackProgram()
        logging.info("   Previewing stack changes...")
    
        const previewRes = await stack.preview({ onOutput: logging.ephemeralInfo, refresh: true, diff: true })

        logging.info(previewRes.stdout)
        return previewRes
    }

    private async doDestroy(): Promise<DestroyResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        logging.info("   Destroying stack...")
        const destroyRes = await stack.destroy({ onOutput: logging.ephemeralInfo });
        logging.ephemeralInfo(`   Update summary: \n${JSON.stringify(destroyRes.summary.resourceChanges, null, 4)}`);

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

export async function pulumiOutputMapToPlainObject(o: OutputMap): Promise<{[key: string]: unknown}> {
    const values : { [key:string]: unknown } = {}
    Object.keys(o).forEach(k => values[k] = o[k].value )
    return values
}