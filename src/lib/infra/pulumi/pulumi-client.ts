import { ConfigMap, DestroyResult, InlineProgramArgs, LocalWorkspace, OutputMap, PreviewResult, PulumiFn, RefreshResult, Stack, StackSummary, UpResult } from "@pulumi/pulumi/automation/index.js"
import { boxLogger, CloudyBoxLogObjI } from "../../logging.js"
import { Logger } from "tslog"

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

    readonly logger: Logger<CloudyBoxLogObjI>
    
    constructor(args: PulumiClientArgs) {
        this.args = args
        this.logger = boxLogger.getSubLogger({ name: "pulumi"})
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

    public async refresh(): Promise<RefreshResult> {
        return this.doRefresh()
    }

    private async createOrSelectPulumiStackProgram() : Promise<Stack>{
    
        const args: InlineProgramArgs = {
            stackName: this.args.stackName,
            projectName: this.args.projectName,
            program: this.args.program
        };

        const stack = await LocalWorkspace.createOrSelectStack(args);        
        await stack.setAllConfig(this.args.config)

        this.logger.info(`Pulumi workdir: ${stack.workspace.workDir}`)
        
        return stack
    }
    
    private async doGetStackOutput() : Promise<OutputMap>{
        const stack = await this.createOrSelectPulumiStackProgram()
        return stack.outputs()
    }    
    
    private async doUp(): Promise<UpResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        const upRes = await stack.up({ onOutput: (m: string) => { this.logPulumi(m) }, refresh: true });
    
        return upRes
    }

    private async doPreview() : Promise<PreviewResult> {
        this.logger.info(`Preview Pulumi stack ${JSON.stringify(this.args)}`)
        const stack = await this.createOrSelectPulumiStackProgram()
    
        const previewRes = await stack.preview({ onOutput: (m: string) => { this.logPulumi(m) }, refresh: true, diff: true })

        return previewRes
    }

    private async doDestroy(): Promise<DestroyResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        const destroyRes = await stack.destroy({ onOutput: (m: string) => { this.logPulumi(m) } });
        this.logger.info(`   Update summary: \n${JSON.stringify(destroyRes.summary.resourceChanges, null, 4)}`);
    
        return destroyRes
    }

    private async doRefresh(): Promise<RefreshResult>{
        const stack = await this.createOrSelectPulumiStackProgram()
        
        const refreshRes = await stack.refresh({ onOutput: (m: string) => { this.logPulumi(m) } });
        this.logger.info(`   Refresh summary: \n${JSON.stringify(refreshRes.summary.resourceChanges, null, 4)}`);
    
        return refreshRes
    }


    private logPulumi(m: string){
        this.logger.info(m)
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