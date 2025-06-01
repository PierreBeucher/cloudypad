import * as os from 'os';
import { PartialDeep } from "type-fest"
import { input, select, confirm, password } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import lodash from 'lodash'
import { InstanceInputs, CommonConfigurationInputV1, CommonInstanceInput, CommonProvisionInputV1, CommonProvisionOutputV1 } from "../core/state/state";
import { getLogger } from "../log/utils";
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../core/const';
import { CreateCliArgs } from './command';
import { CostAlertOptions } from '../core/provisioner';
import { CloudypadClient } from '../core/client';

const { kebabCase } = lodash

/**
 * InputPrompter is an interactive class prompting user for inputs to generate known Provision and Configuration Input interfaces.
 * 
 * It can be passed optional CLI arguments to generate a partial Input interface so as to only prompt for missing inputs.
 */
export interface InputPrompter<A extends CreateCliArgs, PI extends CommonProvisionInputV1, CI extends CommonConfigurationInputV1> {

    /**
     * Given some CLI arguments, ensure a full instance Input is returned.
     * Eg. prompt user for missing inputs.
     */
    completeCliInput(cliArgs: A): Promise<InstanceInputs<PI, CI>>
}

export const STREAMING_SERVER_SUNSHINE = "sunshine"
export const STREAMING_SERVER_WOLF = "wolf"

export interface PromptOptions {
    autoApprove?: boolean
    overwriteExisting?: boolean

    /**
     * If provider emits a quota warning, skip it.
     */
    skipQuotaWarning?: boolean
}

export interface AbstractInputPrompterArgs {
    coreClient: CloudypadClient
}

/**
 * Error thrown when user voluntarily interrupts or refuse a prompt.
 */
export class UserVoluntaryInterruptionError extends Error { }

export abstract class AbstractInputPrompter<
    A extends CreateCliArgs, 
    PI extends CommonProvisionInputV1, 
    CI extends CommonConfigurationInputV1
> implements InputPrompter<A, PI, CI> {

    protected readonly logger = getLogger(AbstractInputPrompter.name)
    protected readonly args: AbstractInputPrompterArgs
    
    constructor(args: AbstractInputPrompterArgs){
        this.args = args
    }

    /**
     * Prompt user for additional provider-specific inputs based on common provider inputs.
     * Returns a fully valid state for instance initialization. 
     */
    async promptInput(partialInput: PartialDeep<InstanceInputs<PI, CI>>, createOptions: PromptOptions): Promise<InstanceInputs<PI, CI>> {
        try {
            const commonInput = await this.promptCommonInput(partialInput, createOptions)

            this.logger.debug(`Prompting specific input with common input ${JSON.stringify(commonInput)}, ` + 
                `partial input ${JSON.stringify(partialInput)} and create options ${JSON.stringify(createOptions)}`)
            const finalInput = await this.promptSpecificInput(commonInput, partialInput, createOptions)
            return finalInput
        } catch (error) {
            if(error instanceof ExitPromptError){
                throw new UserVoluntaryInterruptionError(`User voluntarily interrupted prompt`, { cause: error })
            }

            throw new Error(`Failed to prompt input`, { cause: error })
        }
    }
    
    private async promptCommonInput(partialInput: PartialDeep<CommonInstanceInput>, createOptions: PromptOptions): Promise<CommonInstanceInput> {

        this.logger.debug(`Prompting common input with default inputs ${JSON.stringify(partialInput)} and create options ${JSON.stringify(createOptions)}`)
        
        const instanceName = await this.instanceName(partialInput.instanceName)
        
        const loader = this.args.coreClient.buildStateLoader()
        const alreadyExists = await loader.instanceExists(instanceName)
        if(alreadyExists){
            const overwriteExisting = await this.promptOverwriteExisting(instanceName, createOptions?.overwriteExisting)
            if(!overwriteExisting) {
                throw new Error(`Won't overwrite existing instance ${instanceName}. Initialization aborted.`)
            }
        }

        const sshUser = "ubuntu" // Harcoded default for now since we only support Ubuntu

        const streamingServer = await this.promptStreamingServer(partialInput.configuration?.sunshine?.enable, partialInput.configuration?.wolf?.enable)

        if(streamingServer.sunshineEnabled && streamingServer.wolfEnabled){
            throw new Error("Sunshine and Wolf cannot be enabled both at the same time")
        }
        
        // Force null value for sunshine and wolf as an existing 'undefined' or {} on partial object would not override previous existing value in persisted state
        let sunshineConfig = streamingServer.sunshineEnabled ? {
            enable: streamingServer.sunshineEnabled,
            username: await this.promptSunshineUsername(partialInput.configuration?.sunshine?.username),
            passwordBase64: await this.promptSunshinePasswordBase64(partialInput.configuration?.sunshine?.passwordBase64),
            imageRegistry: partialInput.configuration?.sunshine?.imageRegistry,
            imageTag: partialInput.configuration?.sunshine?.imageTag,
        } : null

        let wolfConfig = streamingServer.wolfEnabled ? {
            enable: streamingServer.wolfEnabled,
        } : null

        const autoStop = await this.promptAutoStop(partialInput.configuration?.autostop?.enable, partialInput.configuration?.autostop?.timeoutSeconds)

        const commonInput: CommonInstanceInput = {
            instanceName: instanceName,
            provision: {
                ssh: {
                    privateKeyPath: partialInput.provision?.ssh?.privateKeyPath, // use provided private key path if set
                    user: sshUser
                }
            },
            configuration: {
                sunshine: sunshineConfig,
                wolf: wolfConfig,
                autostop: {
                    enable: autoStop.autoStopEnable,
                    timeoutSeconds: autoStop.autoStopTimeout,
                },
                keyboard: partialInput.configuration?.keyboard,
                locale: partialInput.configuration?.locale,
                ansible: partialInput.configuration?.ansible,
            }
        }

        this.logger.debug(`Prompted common input ${JSON.stringify(commonInput)}`)

        return commonInput
    }

    /**
     * Prompt provider-specific input using known common Input and passed default input
     */
    protected abstract promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<InstanceInputs<PI, CI>>, createOptions: PromptOptions): Promise<InstanceInputs<PI, CI>>

    /**
     * Transform CLI arguments into known Input interface:
     * - Use a generic function to common inputs into a Partial Input object
     * - Use a provider-specific function to provider-specific inputs into a Partial Input object
     * - Merge both and return the still potentially partial Input (which can be completed by prompting user)
     */
    cliArgsIntoPartialInput(cliArgs: A): PartialDeep<InstanceInputs<PI, CI>> {
        this.logger.debug(`Parsing CLI args ${JSON.stringify(cliArgs)} into Input interface...`)

        const provisionerInput = this.buildProvisionerInputFromCliArgs(cliArgs)
        const commonInput = this.buildCommonInputFromCliArgs(cliArgs)
        const result = lodash.merge({}, commonInput, provisionerInput)
        this.logger.debug(`Parsed CLI args ${JSON.stringify(cliArgs)} into ${JSON.stringify(result)}`)

        return result
    }

    /**
     * Given CLI arguments, return partial Input for common elements.
     */
    private buildCommonInputFromCliArgs(cliArgs: A): PartialDeep<CommonInstanceInput> {
        return {
            instanceName: cliArgs.name,
            provision: {
                ssh: {
                    privateKeyPath: cliArgs.privateSshKey,
                }
            },
            configuration: {
                autostop: cliArgs.autostop !== undefined ? {
                    enable: cliArgs.autostop,
                    timeoutSeconds: cliArgs.autostopTimeout,
                } : undefined,
                // only set streaming server if provided
                // if undefined, no specific CLI args was passed, leave undefined
                // to re-use existing state value or prompt user
                sunshine: cliArgs.streamingServer == STREAMING_SERVER_SUNSHINE ? {
                    enable: true,
                    username: cliArgs.sunshineUser,
                    passwordBase64: cliArgs.sunshinePassword ? Buffer.from(cliArgs.sunshinePassword).toString('base64') : undefined,
                    imageRegistry: cliArgs.sunshineImageRegistry,
                    imageTag: cliArgs.sunshineImageTag,
                } : undefined,
                wolf: cliArgs.streamingServer == STREAMING_SERVER_WOLF ? {
                    enable: true,
                } : undefined,
                locale: cliArgs.useLocale,
                keyboard: cliArgs.keyboardLayout ? {
                    layout: cliArgs.keyboardLayout,
                    model: cliArgs.keyboardModel,
                    variant: cliArgs.keyboardVariant,
                    options: cliArgs.keyboardOptions,
                } : undefined,
                ansible: cliArgs.ansibleAdditionalArgs ? {
                    additionalArgs: cliArgs.ansibleAdditionalArgs,
                } : undefined,
            }
        }
    }

    /**
     * Given CLI arguments, return provider-specific partial input.
     * This method should return an Input object with provider-specific inputs
     * taken from CLI args.
     */
    protected abstract buildProvisionerInputFromCliArgs(cliArgs: A): PartialDeep<InstanceInputs<PI, CI>>

    /**
     * Convert partial CLI arguments into full, concret Input interface to be used by managers:
     * - Use provided CLI args to create a partial Input object
     * - Prompt user for remaining inputs
     * 
     * @param cliArgs 
     * @returns 
     */
    async completeCliInput(cliArgs: A): Promise<InstanceInputs<PI, CI>> {
        const partialInput = this.cliArgsIntoPartialInput(cliArgs)
        const input = await this.promptInput(partialInput, { overwriteExisting: cliArgs.overwriteExisting, autoApprove: cliArgs.yes })
        return input
    }

    protected async instanceName(_instanceName?: string): Promise<string> {
        let instanceName: string
        
        if (_instanceName) {
            instanceName = _instanceName
        } else {
            const userInfo = os.userInfo()
            const defaultInstanceName = `${userInfo.username}`;
            instanceName = await input({
                message: 'Enter instance instanceName:',
                default: defaultInstanceName,
            })
        }

        // Ensure instance name is kebab case
        const kebabCaseInstanceName = kebabCase(instanceName)

        if(kebabCaseInstanceName !== instanceName) {
            const confirmKebabCase = await confirm({
                message: `Instance name must be kebab case. Use ${kebabCaseInstanceName} instead?`,
                default: true,
            })

            if(!confirmKebabCase){
                // let's ask again, without provided default
                return this.instanceName()
            }
        }
        
        return kebabCaseInstanceName 
    }

    protected async promptOverwriteExisting(instanceName: string, overwriteExisting?: boolean): Promise<boolean> {
        if (overwriteExisting !== undefined) {
            return overwriteExisting
        }

        return await confirm({
            message: `Instance ${instanceName} already exists. Do you want to overwrite existing instance config?`,
            default: false,
        })
    }

    protected async useSpotInstance(useSpot?: boolean): Promise<boolean>{
        if (useSpot !== undefined) {
            return useSpot;
        }

        const useSpotChoice = await confirm({
            message: `Do you want to use spot instances ? Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.`,
            default: true,
        })
    
        return useSpotChoice;
    }

    protected async publicIpType(publicIpType?: PUBLIC_IP_TYPE): Promise<PUBLIC_IP_TYPE> {
        if (publicIpType) {
            return publicIpType
        }

        const publicIpTypeChoices: {name: PUBLIC_IP_TYPE, value: PUBLIC_IP_TYPE }[] = [{
            name: PUBLIC_IP_TYPE_STATIC,
            value: PUBLIC_IP_TYPE_STATIC
        },{
            name: PUBLIC_IP_TYPE_DYNAMIC,
            value: PUBLIC_IP_TYPE_DYNAMIC
        }]

        return await select({
            message: 'Use static Elastic IP or dynamic IP? :',
            choices: publicIpTypeChoices,
            default: PUBLIC_IP_TYPE_STATIC,
        })
    }

    protected async informCloudProviderQuotaWarning(provider: string, helpUrl: string){
        await input({ message: `Be aware most Cloud providers have quotas for GPU and some machine types. You may need to request a quota increase to create your instance.\n` +
            `Checkout ${helpUrl} for details about quotas on ${provider} Cloud provider.\n\n` +
            `Press enter to continue...`,
        })
    }

    /**
     * Prompt for cost alert options. See costAlertCliArgsIntoConfig() for more details on costAlert argument handling.
     * 
     * @param costAlert - Cost alert options. If undefined, prompt user for cost alert options.
     * If null, cost alert is explicitely disabled. If set, cost alert is enabled and prompt for missing options.
     * 
     * @returns CostAlertOptions if cost alert is enabled, null if cost alert is disabled
     */
    protected async costAlert(costAlert: Partial<CostAlertOptions> | undefined | null): Promise<CostAlertOptions | null> {
        
        this.logger.debug(`Prompting for billing alert with costAlert: ${JSON.stringify(costAlert)}`)

        const costAlertEnabled = costAlert === null ? false : costAlert !== undefined ? true : await confirm({
            message: "Do you want to enable billing alert? Set a cost limit and get email alerts when spending reaches 50%, 80%, and 100% of the limit.\n" +
                "  Example for $20 limit: get emails alerts at $10, $16, and $20.",
            default: true,
        })

        // Only prompt for billing alert if enabled
        if(costAlertEnabled){
            const costLimit = costAlert?.limit ?? await this.promptBillingAlertLimit()
            const costNotificationEmail = costAlert?.notificationEmail ?? await this.promptBillingAlertEmail()

            return {
                limit: costLimit,
                notificationEmail: costNotificationEmail,
            }
        }

        return null
    }

    private async promptBillingAlertEmail(): Promise<string>{ 
        let costNotificationEmail = await input({
            message: "Enter billing alert notification email:",
            required: true,
        })

        let confirmCostNotificationEmail = await input({
            message: `Confirm email:`,
            required: true,
        })

        if(costNotificationEmail != confirmCostNotificationEmail){
            console.warn("Emails do not match:")
            console.warn(`\t${costNotificationEmail}`)
            console.warn(`\t${confirmCostNotificationEmail}`)
            return this.promptBillingAlertEmail()
        }

        return costNotificationEmail
    }

    private async promptBillingAlertLimit(): Promise<number>{
        const costLimit = await input({
            message: "Enter billing alert limit (USD):",
            default: "30",
        })

        // check if it's a number
        if(isNaN(Number.parseInt(costLimit))){
            console.warn("Please enter a valid number for billing alert limit")
            return this.promptBillingAlertLimit()
        }

        return Number.parseInt(costLimit)
    }

    private async promptStreamingServer(sunshineEnabled?: boolean, wolfEnabled?: boolean): Promise<{ sunshineEnabled: boolean, wolfEnabled: boolean }>{
        if(sunshineEnabled && wolfEnabled){
            throw new Error("Cannot enable both Sunshine and Wolf streaming servers")
        }

        // If one of the streaming server is enabled, return without prompting
        if(sunshineEnabled || wolfEnabled){
            return {
                sunshineEnabled: sunshineEnabled ?? false,
                wolfEnabled: wolfEnabled ?? false,
            }
        }

        const streamingServer = await select({
            message: 'Choose a streaming server:',
            choices: [
                { name: "Sunshine", value: STREAMING_SERVER_SUNSHINE },
                { name: "Wolf", value: STREAMING_SERVER_WOLF },
            ],
        })

        return {
            sunshineEnabled: streamingServer === STREAMING_SERVER_SUNSHINE,
            wolfEnabled: streamingServer === STREAMING_SERVER_WOLF,
        }
    }

    private async promptSunshineUsername(_sunshineUsername?: string): Promise<string> {
        if(_sunshineUsername){
            return _sunshineUsername
        }

        return await input({
            message: "Enter Sunshine Web UI username:",
            default: STREAMING_SERVER_SUNSHINE,
        })
    }

    private async promptSunshinePasswordBase64(_sunshinePasswordBase64?: string): Promise<string> {
        if(_sunshinePasswordBase64){
            return _sunshinePasswordBase64
        } else {

            const sunshinePassword = await password({
                message: "Enter Sunshine Web UI password:",
            })

            if(sunshinePassword.length == 0){
                console.warn("Password cannot be empty.")
                return this.promptSunshinePasswordBase64()
            }

            const sunshinePasswordConfirm = await password({
                message: "Confirm Sunshine Web UI password:",
            })

            if(sunshinePassword !== sunshinePasswordConfirm){
                console.warn("Passwords do not match.")
                return this.promptSunshinePasswordBase64()
            }
            
            return Buffer.from(sunshinePassword).toString('base64')
        }
    }

    private async promptAutoStop(_autoStopEnable?: boolean, _autostopTimeout?: number): Promise<{ autoStopEnable: boolean, autoStopTimeout?: number }> {
        
        let autoStopEnable: boolean
        if(_autoStopEnable !== undefined){
            autoStopEnable = _autoStopEnable
        } else {
            autoStopEnable = await confirm({
                message: "Do you want to enable Auto Stop to shutdown the instance automatically when inactivity is detected?",
                default: true,
            })
        }

        if(!autoStopEnable){
            return {
                autoStopEnable: false,
            }
        }

        let autoStopTimeout: number
        if(_autostopTimeout !== undefined){
            autoStopTimeout = _autostopTimeout
        } else {
            let autoStopTimeoutStr = await select({
                message: "Select Auto Stop timeout:",
                choices: [
                    { name: '10 minutes', value: '600' },
                    { name: '15 minutes', value: '900' },
                    { name: '30 minutes', value: '1800' },
                    { name: 'Enter custom timeout', value: '_' },
                ],
                default: '15 minutes',
            })

            while (autoStopTimeoutStr === '_' || isNaN(Number.parseInt(autoStopTimeoutStr))) {
                if (autoStopTimeoutStr === '_') {
                    autoStopTimeoutStr = await input({
                        message: "Enter Auto Stop timeout in seconds:",
                    })
                }

                if (isNaN(Number.parseInt(autoStopTimeoutStr))) {
                    console.warn("Please enter a valid number for Auto Stop timeout")
                    autoStopTimeoutStr = '_'
                }
            }

            autoStopTimeout = Number.parseInt(autoStopTimeoutStr)
        }

        return {
            autoStopEnable: autoStopEnable,
            autoStopTimeout: autoStopTimeout,
        }
    }
}

export class ConfirmationPrompter {

    private readonly logger = getLogger(ConfirmationPrompter.name)

    async confirmDeploy(instanceName: string, inputs?: PartialDeep<CommonInstanceInput>, autoApprove?: boolean): Promise<boolean> {
        if(autoApprove){
            return true
        }

        const confirmation = await confirm({
            message: `You are about to provision instance ${instanceName} with the following details:\n` + 
            `    ${inputToHumanReadableString(inputs)}` +
            `\nDo you want to proceed?`,
            default: true,
        })

        return confirmation
    }
}

/**
 * Transform CLI arguments into cost alert options.
 * If costAlert is false, return null to explicitly disable cost alert.
 * If costAlert is true, return a (potential empty) object with limit and notificationEmail that prompt will fill.
 * If costAlert is undefined, return undefined to let the prompt handle it.
 */
export function costAlertCliArgsIntoConfig(args: { costAlert?: boolean, costLimit?: number, costNotificationEmail?: string }): PartialDeep<CostAlertOptions> | null |undefined {
    if(args.costAlert === false){
        return null
    } else if (args.costAlert === true) {
        return {
            limit: args.costLimit,
            notificationEmail: args.costNotificationEmail,
        }
    } else if (args.costAlert === undefined){
        // if cost alert is undefined but either costLimit or costNotificationEmail is provided
        // enable cost alert and prompt for missing options
        if(args.costLimit || args.costNotificationEmail){
            return {
                limit: args.costLimit,
                notificationEmail: args.costNotificationEmail,
            }
        }
        
        return undefined
    }
}

/**
 * Transform args into a human readable string, eg.
 * { ssh: { key: '~/.ssh/id_ed25519', user: 'ubuntu' }, instanceName: 'my-instance' } into
 * SSH Key: ~/.ssh/id_ed25519
 * SSH User: ubuntu
 * Instance Name: my-instance
 * 
 */
export function inputToHumanReadableString(args?: PartialDeep<CommonInstanceInput>): string {

    // Shamelessly generated by IA and edited/commented by hand
    const humanReadableArgs = (obj?: any, parentKey?: string): string => {

        if(obj === undefined){
            return ""
        }

        return Object.keys(obj).map(key => {
            
            // If parent key is not empty, add a dot between parent key and current key
            // Otherwise, use current key (only for first level iteration)
            const fullKey = parentKey ? `${parentKey} ${key}` : key;

            // If value is an object, recursively transform it
            if (typeof obj[key] === 'object' && obj[key] !== null && obj[key] !== undefined) {
                return humanReadableArgs(obj[key], fullKey);
            }

            // Tranform original key into human readable key, with MAJ on first letter of each word
            let humanReadableKey = fullKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())

            if(humanReadableKey.startsWith("Ssh")){
                humanReadableKey = humanReadableKey.replace("Ssh", "SSH")
            }

            if(humanReadableKey.startsWith("Ip")){
                humanReadableKey = humanReadableKey.replace("Ip", "IP")
            }

            // Transform value into human readable value (don't transform raw type into string)
            const humanReadableValue =
                typeof obj[key] === 'boolean' ? obj[key] ? 'Yes' : 'No' : 
                obj[key] === undefined || obj[key] === null ? 'None' : 
                String(obj[key])
            return `${humanReadableKey}: ${humanReadableValue}`;
        }).join('\n    ');
    };

    const provision = humanReadableArgs(args?.configuration)
    const configuration = humanReadableArgs(args?.provision)
    return `${provision}\n    ${configuration}`
}