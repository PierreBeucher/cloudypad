import * as fs from 'fs'
import { CommandError, InlineProgramArgs, LocalWorkspace, LocalWorkspaceOptions, OutputMap, PulumiFn, Stack } from "@pulumi/pulumi/automation";
import { getLogger, Logger } from '../../log/utils';
import { CliConfigManager } from '../../cli/config';

export interface InstancePulumiClientArgs {
    program: PulumiFn
    projectName: string
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
}

const LOG_ON_OUTPUT_COLOR = "always"

/**
 * An abstract Pulumi client for a Cloudy Pad instance
 */
export abstract class InstancePulumiClient<ConfigType, OutputType> {

    readonly program: PulumiFn
    readonly projectName: string
    readonly stackName: string
    protected readonly logger: Logger
    private stack: Stack | undefined
    private workspaceOptions?: LocalWorkspaceOptions

    constructor(args: InstancePulumiClientArgs){
        this.program = args.program
        this.projectName = args.projectName
        this.stackName = args.stackName
        this.logger = getLogger(`${args.projectName}-${args.stackName}`)
        this.workspaceOptions = args.workspaceOptions
    }

    protected async getStack(): Promise<Stack>{
        if(this.stack === undefined) {
            this.stack = await this.initStack()
        }
        return this.stack
    }

    public async setConfig(config: ConfigType): Promise<void> {
        // wrap call around this side-effect call to easily stub during test
        await this.doSetConfig(config)
    }

    protected abstract doSetConfig(config: ConfigType): Promise<void>

    protected abstract buildTypedOutput(outputs: OutputMap): Promise<OutputType>

    private async initStack(){
        this.logger.debug(`Initializing stack and config`)

        if(this.stack !== undefined) {
            throw new Error(`Stack ${this.stackName} for project ${this.projectName} has already been initialized. This is probably an internal bug.`)
        }

        // ensure local backend exists for file backend
        const backendUrl = this.workspaceOptions?.envVars?.PULUMI_BACKEND_URL ?? this.workspaceOptions?.projectSettings?.backend?.url
        if(backendUrl?.startsWith("file://")) {
            const backendUrlPath = backendUrl.replace("file://", "")
            fs.mkdirSync(backendUrlPath, { recursive: true })
        }

        const workpaceOpts: LocalWorkspaceOptions | undefined = this.workspaceOptions

        const pulumiArgs: InlineProgramArgs = {
            stackName: this.stackName,
            projectName: this.projectName,
            program: this.program,
        }

        const stack = await LocalWorkspace.createOrSelectStack(pulumiArgs, workpaceOpts)
        return stack
    }

    async up(){

        try {

            const stack = await this.getStack()

            this.logger.debug(`Running Pulumi up: ${stack.name}`)
            this.logger.debug(`Config before up: ${JSON.stringify(await stack.getAllConfig())}`)

            // Always cancel in case command was interrupted before
            // Considering use case it's unlikely a parallel update might occur
            // But it's likely that user will interrupt leaving stack with a lock which would stuck otherwise
            // Might become a flag later
            await stack.cancel()

            const upRes = await stack.up({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR, refresh: true })
            
            this.logger.trace(`Up result: ${JSON.stringify(upRes)}`)
            
            const outputs = await stack.outputs()

            this.logger.debug(`Up outputs: ${JSON.stringify(outputs)}`)

            return this.buildTypedOutput(outputs)

        } catch (e) {
            if(e instanceof CommandError) {
                try {
                    // CommandError contains the entire Pulumi output stderr/stdout in message and stack field which renders error unusable as-is
                    // Instead transform private commandResult objecft fields which may actually be useful
                    const commandResultJson = JSON.parse(JSON.stringify(e))

                    const pulumiErrorData = {
                        code: commandResultJson.code,
                        command: commandResultJson.err?.command,
                        exitCode: commandResultJson.err?.exitCode,
                        failed: commandResultJson.err?.failed,
                        timedOut: commandResultJson.err?.timedOut,
                        isCanceled: commandResultJson.err?.isCanceled,
                        killed: commandResultJson.err?.killed
                    }
                    
                    throw new Error(`Pulumi up command failure. See above error logs for details. Error data: ${JSON.stringify(pulumiErrorData)}`)

                } catch (e) {
                    // Throw anyway if somehow we couldn't parse original PulumiError error
                    throw new Error(`Pulumi up command failure. See above error logs for details.`)
                }
            } else {
                throw new Error(`Pulumi up failure`, { cause: e })
            }
        }
    }

    async preview(){
        const stack = await this.getStack()

        this.logger.debug(`Running Pulumi preview: ${stack.name}`)
        this.logger.debug(`Config before up: ${JSON.stringify(await stack.getAllConfig())}`)

        // Always cancel in case command was interrupted before
        // Considering use case it's unlikely a parallel update might occur
        // But it's likely that user will interrupt leaving stack with a lock which would stuck otherwise
        // Might become a flag later
        await stack.cancel()

        const prevRes = await stack.preview({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR, refresh: true })
        
        this.logger.trace(`Preview result: ${JSON.stringify(prevRes)}`)

        return prevRes
    }

    async destroy(){
        this.logger.debug(`Destroying stack`)
        const stack = await this.getStack()

        // Always cancel in case command was interrupted before
        // Considering use case it's unlikely a parallel update might occur
        // But it's likely that user will interrupt leaving stack with a lock which would stuck otherwise
        // Might become a flag later
        await stack.cancel()
        
        this.logger.debug(`Refreshing stack ${stack.name} before destroy result`)

        const refreshRes = await stack.refresh({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR })
        this.logger.trace(`Refresh result: ${JSON.stringify(refreshRes)}`)

        const destroyRes = await stack.destroy({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR, remove: true })
        this.logger.trace(`Destroy result: ${JSON.stringify(destroyRes)}`)
   }

   /**
    * Log Pulumi output to console using stdout directly and tweaking a bit the output for nicer display
    * @param msg raw pulumi output on stack action
    */
   private async stackLogOnOutput(_msg: string){

    let msg = _msg
    if(msg.trim() === ".") msg = "." // if msg is a dot with newlines or spaces, print it as a dot without newline

    process.stdout.write(msg)
   }
}
