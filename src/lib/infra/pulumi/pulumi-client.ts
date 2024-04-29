import { CommandError, ConfigMap, DestroyResult, InlineProgramArgs, LocalWorkspace, LocalWorkspaceOptions, OutputMap, PreviewResult, ProjectSettings, PulumiFn, RefreshResult, Stack, StackSummary, UpResult } from "@pulumi/pulumi/automation/index.js"
import { componentLogger, CloudyBoxLogObjI } from "../../logging.js"
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

    private workspaceOptions?: LocalWorkspaceOptions | undefined
    
    constructor(args: PulumiClientArgs) {
        this.args = args
        this.logger = componentLogger.getSubLogger({ name: "pulumi"})
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

    /**
     * Build a LocalWorkspaceOptions in current context, allowing seamless UX for users:
     * - If Pulumi CLI is not logged-in, use local backend by default
     * - If a stack passphrase is not passed via PULUMI_CONFIG_PASSPHRASE, use empty string
     * 
     * Generated LocalWorkspaceOption is kept on first run as class field, any subsequent
     * call will re-use the same LocalWorkspaceOption instance.
     * 
     * TODO UNIT TEST
     */
    private async getWorkspaceOptions() : Promise<LocalWorkspaceOptions> {
        if (this.workspaceOptions) {
            return this.workspaceOptions
        }

        const projectSettings: ProjectSettings = {
            name: this.args.projectName,
            runtime: {
                name: "nodejs"
            },
        }

        const envVars: {[key: string]: string} = {}

        // Check with whoami if currently authenticated
        // If not authenticate, set projectSettings to use local backend
        const wk = await LocalWorkspace.create({})        
        try{
            const whoami = await wk.whoAmI()
            this.logger.debug(`Pulumi already authenticated (${JSON.stringify(whoami)}), using existing backend.`)
        } catch (error){
            if(error instanceof CommandError) {
                if(error.message.includes("PULUMI_ACCESS_TOKEN must be set")){
                    this.logger.debug("Pulumi not authenticated, using local backend by default.")
                    
                    projectSettings.backend = {
                        url: "file://~",
                    }

                } else {
                    this.logger.error(`Unknwon Pulumi command error: ${error}`)
                    throw error
                }
            } else {
                this.logger.error(`Unkwnon error when checking Pulumi authencation status: ${error}`)
                throw error
            }
        }

        // If backend to use is local backend and no passphrase already set, set empty string by default
        if(process.env["PULUMI_CONFIG_PASSPHRASE"] === undefined && process.env["PULUMI_CONFIG_PASSPHRASE_FILE"] === undefined){
            this.logger.debug("Neither PULUMI_CONFIG_PASSPHRASE nor PULUMI_CONFIG_PASSPHRASE_FILE env variable is set, using empty string by default.")
            envVars["PULUMI_CONFIG_PASSPHRASE"] = ""
        }

        const workspaceOpts: LocalWorkspaceOptions = {
            projectSettings: projectSettings,
            envVars: envVars
        }

        this.workspaceOptions = workspaceOpts

        return workspaceOpts

    }

    private async createOrSelectPulumiStackProgram() : Promise<Stack>{
        
        const workspaceOpts = await this.getWorkspaceOptions()

        // TODO hide sensible info like passphrase
        this.logger.debug(`Using project settings: ${JSON.stringify(workspaceOpts)}`)

        const args: InlineProgramArgs = {
            stackName: this.args.stackName,
            projectName: this.args.projectName,
            program: this.args.program,
        };

        const stack = await LocalWorkspace.createOrSelectStack(args, workspaceOpts);        
        
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