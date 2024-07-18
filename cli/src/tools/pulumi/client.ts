import * as fs from 'fs'
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ConfigMap, InlineProgramArgs, LocalWorkspace, LocalWorkspaceOptions, OutputMap, PulumiFn, Stack } from "@pulumi/pulumi/automation";
import { CLOUDYPAD_HOME } from "../../core/const"

// Force use of local backend unless environment configured otherwise
export const CLOUDYPAD_LOCAL_PULUMI_BACKEND_DIR = `${CLOUDYPAD_HOME}/pulumi-backend` // Not a Pulumi built-in en var
export const PULUMI_BACKEND_URL=process.env.PULUMI_BACKEND_URL ?? `file://${CLOUDYPAD_HOME}/pulumi-backend`
export const PULUMI_CONFIG_PASSPHRASE=`${process.env.PULUMI_CONFIG_PASSPHRASE ?? ""}`

export interface InstancePulumiClientArgs {
    program: PulumiFn
    projectName: string
    stackName: string
}

/**
 * An abstract Pulumi client for a Cloudy Pad instance
 */
export abstract class InstancePulumiClient<ConfigType, OutputType> {

    readonly program: PulumiFn
    readonly projectName: string
    readonly stackName: string
    
    private stack: Stack | undefined

    constructor(args: InstancePulumiClientArgs){
        this.program = args.program
        this.projectName = args.projectName
        this.stackName = args.stackName
    }

    protected async getStack(){
        if(this.stack === undefined) {
            this.stack = await this.initStack()
        }
        return this.stack
    }

    public abstract setConfig(config: ConfigType): Promise<void>

    protected abstract buildTypedOutput(outputs: OutputMap): Promise<OutputType>

    private async initStack(){
        if(this.stack !== undefined) {
            throw new Error(`Stack ${this.stackName} for project ${this.projectName} has already been initialized. This is probably an internal bug.`)
        }

        const opts: LocalWorkspaceOptions = {
            envVars: {
                PULUMI_BACKEND_URL: PULUMI_BACKEND_URL,
                PULUMI_CONFIG_PASSPHRASE: PULUMI_CONFIG_PASSPHRASE
            }
        }

        // Ensure Pulumi directories exists
        // TODO unit test 
        if(PULUMI_BACKEND_URL.startsWith("file://")){
            const pulumiBackendDir = PULUMI_BACKEND_URL.slice("file://".length)
            if (!fs.existsSync(pulumiBackendDir)){
                fs.mkdirSync(pulumiBackendDir, { recursive: true });
            }
        }

        const pulumiArgs: InlineProgramArgs = {
            stackName: this.stackName,
            projectName: this.projectName,
            program: this.program,
        }

        const stack = await LocalWorkspace.createOrSelectStack(pulumiArgs, opts)
        return stack
    }

    async up(){

        const stack = await this.getStack()

        console.debug(`Config before up: ${JSON.stringify(await stack.getAllConfig())}`)

        const upRes = await stack.up({ onOutput: console.info, color: "auto", refresh: true });
        console.debug(`Result: ${JSON.stringify(upRes)}`)

        const outputs = await stack.outputs()
        return this.buildTypedOutput(outputs)
    }

    async destroy(){
        const stack = await this.initStack()
        
        const destroyRes = await stack.destroy({ onOutput: console.info, color: "auto", remove: true });
        console.debug(`Result: ${JSON.stringify(destroyRes)}`)
   }
}