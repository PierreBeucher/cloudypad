import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PartialDeep } from "type-fest"
import { input, select, confirm } from '@inquirer/prompts';
import lodash from 'lodash'
import { CommonConfigurationInputV1, CommonInstanceInput, CommonProvisionInputV1 } from "../state/state";
import { getLogger } from "../../log/utils";
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from '../const';
import { CreateCliArgs, UpdateCliArgs } from './command';
import { StateLoader } from '../state/loader';
import { CostAlertOptions } from '../provisioner';
const { kebabCase } = lodash

export interface InputPrompter {

    /**
     * Given some CLI arguments, ensure a full instance Input is returned.
     * Eg. prompt user for missing inputs.
     */
    completeCliInput(cliArgs: CreateCliArgs): Promise<CommonInstanceInput>
}

export interface PromptOptions {
    autoApprove?: boolean
    overwriteExisting?: boolean

    /**
     * If provider emits a quota warning, skip it.
     */
    skipQuotaWarning?: boolean
}

export abstract class AbstractInputPrompter<A extends CreateCliArgs, I extends CommonInstanceInput> implements InputPrompter {

    protected readonly logger = getLogger(AbstractInputPrompter.name)

    /**
     * Prompt user for additional provider-specific inputs based on common provider inputs.
     * Returns a fully valid state for instance initialization. 
     */
    async promptInput(partialInput: PartialDeep<I>, createOptions: PromptOptions): Promise<I> {
        const commonInput = await this.promptCommonInput(partialInput, createOptions)
        const commonInputWithPartial = lodash.merge({}, commonInput, partialInput)
        const finalInput = await this.promptSpecificInput(commonInputWithPartial, createOptions)
        return finalInput
    }
    
    private async promptCommonInput(partialInput: PartialDeep<CommonInstanceInput>, createOptions: PromptOptions): Promise<CommonInstanceInput> {

        this.logger.debug(`Prompting common input with default inputs ${JSON.stringify(partialInput)} and create options ${JSON.stringify(createOptions)}`)
        
        const instanceName = await this.instanceName(partialInput.instanceName)
        
        const alreadyExists = await new StateLoader().instanceExists(instanceName)
        if(alreadyExists){
            const overwriteExisting = await this.promptOverwriteExisting(instanceName, createOptions?.overwriteExisting)
            if(!overwriteExisting) {
                throw new Error(`Won't overwrite existing instance ${instanceName}. Initialization aborted.`)
            }
        }

        const sshKey = await this.privateSshKey(partialInput.provision?.ssh?.privateKeyPath)
        const sshUser = "ubuntu" // Harcoded default for now since we only support Ubuntu

        return {
            instanceName: instanceName,
            provision: {
                ssh: {
                    privateKeyPath: sshKey,
                    user: sshUser
                }
            },
            configuration: {}
        }
    }

    /**
     * Prompt provider-specific input using known common Input and passed default input
     */
    protected abstract promptSpecificInput(defaultInput: CommonInstanceInput & PartialDeep<I>, createOptions: PromptOptions): Promise<I>

    /**
     * Transform CLI arguments into known Input interface
     */
    cliArgsIntoInput(cliArgs: A): PartialDeep<I> {
        this.logger.debug(`Parsing CLI args ${JSON.stringify(cliArgs)} into Input interface...`)

        const result = this.doTransformCliArgsIntoInput(cliArgs)
        
        this.logger.debug(`Parsed CLI args ${JSON.stringify(cliArgs)} into ${JSON.stringify(result)}`)

        return result
    }

    /**
     * Transform CLI arguments into known Input interface
     */
    protected abstract doTransformCliArgsIntoInput(cliArgs: A): PartialDeep<I>

    async completeCliInput(cliArgs: A): Promise<I> {
        const partialInput = this.cliArgsIntoInput(cliArgs)
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

    protected async privateSshKey(privateSshKey?: string): Promise<string> {
        if (privateSshKey) {
            return privateSshKey;
        }

        const sshDir = path.join(os.homedir(), '.ssh')

        this.logger.debug(`Looking for SSH keys in ${sshDir}`)

        let sshFiles: string[] = []
        if(fs.existsSync(sshDir) && fs.statSync(sshDir).isDirectory()) {
            sshFiles = fs.readdirSync(sshDir)
            this.logger.debug(`Found SSH key files ${JSON.stringify(sshFiles)}`)
        } else {
            this.logger.debug(`Couldn't find SSH private key, not a directory: ${sshDir}`)
        }

        const privateKeys = sshFiles
            .filter(file => file.startsWith('id_') && !file.endsWith('.pub')) // TODO A bit naive method. Maybe we can read all files and check if they are private keys
            .map(file => path.join(sshDir, file))
    
        let privateKeyPath: string
        if (!privateKeys.length){
            console.info(`No SSH private key found in ${sshDir}. You can generate one with 'ssh-keygen -t ed25519 -a 100'.`)
            privateKeyPath = await input({
                message: 'Please enter path to a valid SSH private key to create your instance:'
            })
        } else {
        const sshKeyChoices = privateKeys.map(k => ({
            instanceName: k,
            value: k
        }))
    
            privateKeyPath = await select({
            message: 'Choose an SSH private key to connect to instance:',
            choices: sshKeyChoices
        })
        }

        console.info(`Using SSH private key ${privateKeyPath}`)
    
        return privateKeyPath;
    }

    protected async useSpotInstance(useSpot?: boolean): Promise<boolean>{
        if (useSpot) {
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