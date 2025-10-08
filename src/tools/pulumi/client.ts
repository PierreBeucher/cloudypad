import * as fs from 'fs'
import { ConcurrentUpdateError, InlineProgramArgs, LocalWorkspace, LocalWorkspaceOptions, OutputMap, PulumiFn, Stack } from "@pulumi/pulumi/automation";
import { getLogger, Logger } from '../../log/utils';

export interface PulumiActionOptions {
    /**
     * Cancel any stuck Pulumi operations before running the action
     */
    cancel?: boolean
}

export const DEFAULT_RETRY_DELAY = 10000
export const DEFAULT_RETRY_MAX_RETRIES = 12
export const DEFAULT_RETRY_LOG_BEHAVIOR = "warn"

export interface InstancePulumiClientArgs {
    program: PulumiFn
    projectName: string
    stackName: string
    workspaceOptions?: LocalWorkspaceOptions
    clientOptions?: {

        /**
         * Options for retrying actions on locked stacks
         */
        retry?: {

            /**
             * The condition under which the action should be retried. Default: "OnConcurrentUpdateError"
             * 
             * "OnConcurrentUpdateError" - Retry only on ConcurrentUpdateError (when a concurrent update is detected as a lockfile is present)
             */
            when?: "OnConcurrentUpdateError" | "Always"

            /**
             * The maximum number of retries. Default: 3
             */
            maxRetries?: number

            /**
             * The delay between retries in milliseconds. Default: 10000
             */
            retryDelay?: number

            /**
             * The behavior of the logger when retrying. Default: "warn"
             */
            logBehavior?: "error" | "warn" | "info" | "debug" | "trace" | "silent"
        }
    }
}

const LOG_ON_OUTPUT_COLOR = "always"

/**
 * An abstract Pulumi client for a Cloudy Pad instance. 
 * 
 * This class is abstract and must be extended to create a concrete Pulumi client for a specific Cloudy Pad instance.
 *
 * Implement tries to be lock-safe: when running on a stack that is locked, it will retry up to a max number of times with a delay between retries.
 * 
 */
export abstract class InstancePulumiClient<ConfigType extends Object, OutputType> {

    readonly program: PulumiFn
    readonly projectName: string
    readonly stackName: string
    protected readonly logger: Logger
    private stack: Stack | undefined
    private workspaceOptions?: LocalWorkspaceOptions
    private clientOptions?: InstancePulumiClientArgs["clientOptions"]
    constructor(args: InstancePulumiClientArgs) {
        this.program = args.program
        this.projectName = args.projectName
        this.stackName = args.stackName
        this.logger = getLogger(`${args.projectName}-${args.stackName}`)
        this.workspaceOptions = args.workspaceOptions
        this.clientOptions = args.clientOptions
    }

    protected async getStack(): Promise<Stack> {
        if (this.stack === undefined) {
            this.stack = await this.initStack()
        }
        return this.stack
    }

    public async getOutputs(): Promise<OutputType> {
        const stack = await this.getStack()
        const outputs = await stack.outputs()
        return this.buildTypedOutput(outputs)
    }

    async refresh(options?: PulumiActionOptions): Promise<OutputType> {
        return this._doStackActionRetryOnLocked({ action: () => this._doRefresh(options) })
    }

    async _doRefresh(options?: PulumiActionOptions): Promise<OutputType> {
        const stack = await this.getStack()

        if (options?.cancel) {
            this.logger.debug(`Cancelling any stuck Pulumi operations for stack: ${stack.name}`)
            try {
                await stack.cancel()
                this.logger.debug(`Successfully cancelled stuck operations for stack: ${stack.name}`)
            } catch (error) {
                this.logger.debug(`No operations to cancel for stack: ${stack.name}`, error)
            }
        }

        this.logger.debug(`Refreshing stack ${this.stackName}`)

        const result = await stack.refresh({
            onOutput: this.stackLogOnOutput,
            color: LOG_ON_OUTPUT_COLOR,
        })

        this.logger.debug(`Refresh result: ${JSON.stringify(result)}`)

        return this.getOutputs()
    }

    public async setConfig(config: ConfigType): Promise<void> {
        // wrap call around this side-effect call to easily stub during test
        await this.doSetConfig(config)
    }

    protected abstract doSetConfig(config: ConfigType): Promise<void>

    protected abstract buildTypedOutput(outputs: OutputMap): Promise<OutputType>

    private async initStack() {
        this.logger.debug(`Initializing stack and config`)

        if (this.stack !== undefined) {
            throw new Error(`Stack ${this.stackName} for project ${this.projectName} has already been initialized. This is probably an internal bug.`)
        }

        // ensure local backend exists for file backend
        const backendUrl = this.workspaceOptions?.envVars?.PULUMI_BACKEND_URL ?? this.workspaceOptions?.projectSettings?.backend?.url
        if (backendUrl?.startsWith("file://")) {
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

    async up(options?: PulumiActionOptions): Promise<OutputType> {
        return this._doStackActionRetryOnLocked({ action: () => this._doUp(options) })
    }

    async _doUp(options?: PulumiActionOptions): Promise<OutputType> {
        const stack = await this.getStack()

        if (options?.cancel) {
            this.logger.debug(`Cancelling any stuck Pulumi operations for stack: ${stack.name}`)
            try {
                await stack.cancel()
                this.logger.debug(`Successfully cancelled stuck operations for stack: ${stack.name}`)
            } catch (error) {
                this.logger.debug(`No operations to cancel for stack: ${stack.name}`, error)
            }
        }

        this.logger.debug(`Running Pulumi up: ${stack.name}`)
        this.logger.debug(`Config before up: ${JSON.stringify(await stack.getAllConfig())}`)

        const upRes = await stack.up({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR, refresh: true })

        this.logger.trace(`Up result: ${JSON.stringify(upRes)}`)

        const outputs = await stack.outputs()

        this.logger.debug(`Up outputs: ${JSON.stringify(outputs)}`)

        return this.buildTypedOutput(outputs)
    }

    async preview() {
        return this._doStackActionRetryOnLocked({ action: () => this._doPreview() })
    }

    async _doPreview() {
        const stack = await this.getStack()

        this.logger.debug(`Running Pulumi preview: ${stack.name}`)
        this.logger.debug(`Config before up: ${JSON.stringify(await stack.getAllConfig())}`)

        const prevRes = await stack.preview({ onOutput: this.stackLogOnOutput, color: LOG_ON_OUTPUT_COLOR, refresh: true })

        this.logger.trace(`Preview result: ${JSON.stringify(prevRes)}`)

        return prevRes
    }

    async destroy(options?: PulumiActionOptions) {
        return this._doStackActionRetryOnLocked({ action: () => this._doDestroy(options) })
    }

    async _doDestroy(options?: PulumiActionOptions) {
        this.logger.debug(`Destroying stack`)
        const stack = await this.getStack()

        if (options?.cancel) {
            this.logger.debug(`Cancelling any stuck Pulumi operations for stack: ${stack.name}`)
            try {
                await stack.cancel()
                this.logger.debug(`Successfully cancelled stuck operations for stack: ${stack.name}`)
            } catch (error) {
                this.logger.debug(`No operations to cancel for stack: ${stack.name}`, error)
            }
        }

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
    private async stackLogOnOutput(_msg: string) {

        let msg = _msg
        if (msg.trim() === ".") msg = "." // if msg is a dot with newlines or spaces, print it as a dot without newline

        process.stdout.write(msg)
    }

    /**
     * Execute a Pulumi action with retry logic. Retry logic is only applied to ConcurrentUpdateError (when a concurrent update is detected a a lockfile is present)
     * @param args.action - The action to execute
     * @param args.maxRetries - The maximum number of retries, 0 means no retries. (default: 3)
     * @param args.retryDelay - The delay between retries in milliseconds (default: 10000)
     * @returns The result of the action    
     */
    async _doStackActionRetryOnLocked<O>(args: { action: () => Promise<O>, maxRetries?: number, retryDelay?: number }): Promise<O> {
        const maxRetries = args.maxRetries ?? this.clientOptions?.retry?.maxRetries ?? DEFAULT_RETRY_MAX_RETRIES
        const retryDelay = args.retryDelay ?? this.clientOptions?.retry?.retryDelay ?? DEFAULT_RETRY_DELAY

        try {
            // await is important to get error if any
            return await args.action()
        } catch (e) {
            if (e instanceof ConcurrentUpdateError && maxRetries > 0) {
                const logBehavior = this.clientOptions?.retry?.logBehavior ?? DEFAULT_RETRY_LOG_BEHAVIOR
                const logMsg = `Concurrent update error, retrying in ${retryDelay}ms... Original error:`
                switch (logBehavior) {
                    case "error":
                        this.logger.error(logMsg, e)
                        break
                    case "warn":
                        this.logger.warn(logMsg, e)
                        break
                    case "info":
                        this.logger.info(logMsg, e)
                        break
                    case "debug":
                        this.logger.debug(logMsg, e)
                        break
                    case "trace":
                        this.logger.trace(logMsg, e)
                        break
                    case "silent":
                        break
                }
                await new Promise(resolve => setTimeout(resolve, retryDelay))
                return this._doStackActionRetryOnLocked({ action: args.action, maxRetries: maxRetries - 1, retryDelay })
            }

            throw new Error(`Pulumi action failure. `, { cause: e })
        }
    }
}
