import { PaperspaceInstanceInput, PaperspaceInstanceStateV1, PaperspaceProvisionInputV1, PaperspaceStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import { select, input, password } from '@inquirer/prompts';
import { fetchApiKeyFromEnvironment } from './client/client';
import lodash from 'lodash'
import { PartialDeep } from "type-fest";
import { CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE } from "../../core/const";
import { CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_DISK_SIZE, CLI_OPTION_PUBLIC_IP_TYPE, CLI_OPTION_SPOT, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS, BuildCreateCommandArgs, BuildUpdateCommandArgs } from "../../cli/command";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { RUN_COMMAND_CREATE, RUN_COMMAND_UPDATE } from "../../tools/analytics/events";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { PaperspaceProviderClient } from "./provider";

export interface PaperspaceCreateCliArgs extends CreateCliArgs {
    apiKeyFile?: string
    machineType?: string
    diskSize?: number
    publicIpType?: PUBLIC_IP_TYPE
    region?: string
}

export type PaperspaceUpdateCliArgs = UpdateCliArgs & Omit<PaperspaceCreateCliArgs, "region">

export class PaperspaceInputPrompter extends AbstractInputPrompter<PaperspaceCreateCliArgs, PaperspaceProvisionInputV1, CommonConfigurationInputV1> {
    
    buildProvisionerInputFromCliArgs(cliArgs: PaperspaceCreateCliArgs): PartialDeep<PaperspaceInstanceInput> {
        return {
            instanceName: cliArgs.name,
            provision: {
                apiKey: cliArgs.apiKeyFile,
                machineType: cliArgs.machineType,
                diskSize: cliArgs.diskSize,
                publicIpType: cliArgs.publicIpType,
                region: cliArgs.region,
            },
        }
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<PaperspaceInstanceInput>, createOptions: PromptOptions): Promise<PaperspaceInstanceInput> {

        if(!createOptions.autoApprove && !createOptions.skipQuotaWarning){
            await this.informCloudProviderQuotaWarning(CLOUDYPAD_PROVIDER_PAPERSPACE, "https://docs.cloudypad.gg/cloud-provider-setup/paperspace.html")
        }
        
        const apiKey = await this.apiKey(partialInput.provision?.apiKey)
        const machineType = await this.machineType(partialInput.provision?.machineType)
        const diskSize = await this.diskSize(partialInput.provision?.diskSize)
        const publicIpType = await this.publicIpType(partialInput.provision?.publicIpType)
        const region = await this.region(partialInput.provision?.region)
        const sshUser = "paperspace" // Paperspace uses 'paperspace' SSH user, enforce it

        if(!createOptions.autoApprove){
            await this.promptBillingAlertSetup()
        }

        const specificInput = {
            provision: {
                apiKey: apiKey,
                machineType: machineType,
                diskSize: diskSize,
                publicIpType: publicIpType,
                region: region,
                ssh: {
                    user: sshUser,
                }
            },
        }
        
        const psInput: PaperspaceInstanceInput = lodash.merge(
            {},
            commonInput,
            specificInput
        )

        return psInput
    }

    protected async promptBillingAlertSetup() {
        await input({
            message: "To prevent accidental overcost, it is advised to setup cost alerts. Unfortunately, Paperspace does not support automation of this feature yet.\n" +
                "  Please go to Paperspace console and setup alerts for your account: https://console.paperspace.com\n" +
                "  Billing > Alerts > Manage Billing Alerts\n\n" +
                "  Press Enter to continue..."
        })
    }

    protected async machineType(machineType?: string): Promise<string> {
        if (machineType) {
            return machineType;
        }

        const choices = ['M4000', 'P4000', 'A4000', 'RTX4000', 'P5000', 'RTX5000', 'P6000', 'A5000', 'A6000' ].sort().map(type => ({ name: type, value: type }))
        choices.push({name: "Let me type an instance type", value: "_"})
        
        const selectedInstanceType = await select({
            message: 'Select machine type:',
            loop: false,
            choices: choices,
            default: "RTX4000"
        })

        if(selectedInstanceType === '_'){
            return await input({
                message: 'Enter machine type:',
            })
        }

        return selectedInstanceType
    }

    protected async diskSize(diskSize?: number): Promise<number> {
        if (diskSize) {
            return diskSize;
        }

        const selectedDiskSize = await select({
            message: 'Select disk size (GB):',
            choices: ['50', '100', '250', '500', '1000', '2000'].map(size => ({ name: size, value: size })),
        });

        return Number.parseInt(selectedDiskSize);
    }

    protected async region(region?: string): Promise<string> {
        if (region) {
            return region;
        }

        return await select({
            message: 'Select region for new machine:',
            choices: ['East Coast (NY2)', 'West Coast (CA1)', 'Europe (AMS1)'].map(r => ({ name: r, value: r }))
        });
    }

    protected async apiKey(apiKey?: string): Promise<string>{
        if (apiKey) return apiKey

        const envApiKey = fetchApiKeyFromEnvironment() 

        if(envApiKey.length == 0) {
            return await password({
                message: 'No Paperspace API Key found. Restart with environment variable PAPERSPACE_API_KEY or enter API Key:'
            });
        } else if(envApiKey.length == 1){
            return envApiKey[0]
        } else {
            throw new Error("Found multiple keys in your Paperspace home config. Please specify a single key suing either PAPERSPACE_API_KEY." +
                "(Later version will support multiple keys and let you specify a team to choose from)")
        }
    }
}

export class PaperspaceCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_PAPERSPACE)
            .addOption(CLI_OPTION_SPOT)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .addOption(CLI_OPTION_STREAMING_SERVER)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
            .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
            .addOption(CLI_OPTION_USE_LOCALE)
            .addOption(CLI_OPTION_KEYBOARD_LAYOUT)
            .addOption(CLI_OPTION_KEYBOARD_MODEL)
            .addOption(CLI_OPTION_KEYBOARD_VARIANT)
            .addOption(CLI_OPTION_KEYBOARD_OPTIONS)
            .option('--api-key-file <apikeyfile>', 'Path to Paperspace API key file')
            .option('--machine-type <type>', 'Machine type')
            .option('--region <region>', 'Region in which to deploy instance')
            .action(async (cliArgs: PaperspaceCreateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_CREATE, { provider: CLOUDYPAD_PROVIDER_PAPERSPACE })
                try {
                    await new InteractiveInstanceInitializer<PaperspaceInstanceStateV1, PaperspaceCreateCliArgs>({ 
                        providerClient: new PaperspaceProviderClient({ config: args.coreConfig }),
                        inputPrompter: new PaperspaceInputPrompter({ coreConfig: args.coreConfig }),
                        initArgs: cliArgs
                    }).initializeInteractive()
                    
                } catch (error) {
                    throw new Error('Paperspace instance initilization failed', { cause: error })
                }
            })
    }

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_PAPERSPACE)
            .addOption(CLI_OPTION_DISK_SIZE)
            .addOption(CLI_OPTION_PUBLIC_IP_TYPE)
            .addOption(CLI_OPTION_SUNSHINE_USERNAME)
            .addOption(CLI_OPTION_SUNSHINE_PASSWORD)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_TAG)
            .addOption(CLI_OPTION_SUNSHINE_IMAGE_REGISTRY)
            .addOption(CLI_OPTION_AUTO_STOP_ENABLE)
            .addOption(CLI_OPTION_AUTO_STOP_TIMEOUT)
            .option('--api-key-file <apikeyfile>', 'Path to Paperspace API key file')
            .option('--machine-type <type>', 'Machine type')
            .action(async (cliArgs: PaperspaceUpdateCliArgs) => {
                this.analytics.sendEvent(RUN_COMMAND_UPDATE, { provider: CLOUDYPAD_PROVIDER_PAPERSPACE })
                try {
                    await new InteractiveInstanceUpdater<PaperspaceInstanceStateV1, PaperspaceUpdateCliArgs>({
                        providerClient: new PaperspaceProviderClient({ config: args.coreConfig }),
                        inputPrompter: new PaperspaceInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Paperspace instance update failed', { cause: error })
                }
            })
    }
}

