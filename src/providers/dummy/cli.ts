import { DummyInstanceInput, DummyInstanceStateV1, DummyProvisionInputV1, DummyStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { select } from '@inquirer/prompts';
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import lodash from 'lodash'
import { CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS } from "../../cli/command";
import { CLOUDYPAD_PROVIDER_DUMMY } from "../../core/const";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { cleanupAndExit, logFullError } from "../../cli/program";

export interface DummyCreateCliArgs extends CreateCliArgs {
    instanceType?: string
    startingTimeSeconds?: number
    stoppingTimeSeconds?: number
}

export type DummyUpdateCliArgs = UpdateCliArgs


export class DummyInputPrompter extends AbstractInputPrompter<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1> {
    
    buildProvisionerInputFromCliArgs(cliArgs: DummyCreateCliArgs): PartialDeep<DummyInstanceInput> {
        return {
            provision: {
                instanceType: cliArgs.instanceType,
                startingTimeSeconds: cliArgs.startingTimeSeconds,
                stoppingTimeSeconds: cliArgs.stoppingTimeSeconds,
            }
        }
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<DummyInstanceInput>, createOptions: PromptOptions): Promise<DummyInstanceInput> {

        const instanceType = await this.instanceType(partialInput.provision?.instanceType)

        const dummyInput: DummyInstanceInput = lodash.merge(
            {},
            commonInput, 
            {
                provision:{
                    instanceType: instanceType,
                    startingTimeSeconds: partialInput.provision?.startingTimeSeconds ?? 10,
                    stoppingTimeSeconds: partialInput.provision?.stoppingTimeSeconds ?? 10,
                }
            })
        
        return dummyInput
        
    }

    private async instanceType(instanceType?: string): Promise<string> {

        if (instanceType) {
            return instanceType;
        }

        const choices = [{
            name: "Dummy Instance Type 1",
            value: "dummy-instance-type-1"
        }, {
            name: "Dummy Instance Type 2 (best value !)",
            value: "dummy-instance-type-2"
        }]

        const selectedInstanceType = await select({
            message: 'Choose an instance type:',
            default: "dummy-instance-type-1",
            choices: choices,
            loop: false,
        })

        
        return selectedInstanceType        
    }
    
}

export class DummyCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand() {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_DUMMY)
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
            .option('--instance-type <type>', 'EC2 instance type')
            .action(async (cliArgs: DummyCreateCliArgs) => {
                
                try {
                    await new InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1>({ 
                        inputPrompter: new DummyInputPrompter(),
                        provider: CLOUDYPAD_PROVIDER_DUMMY,
                        initArgs: cliArgs
                    }).initializeInteractive()
                    
                } catch (error) {
                    logFullError(error)
                
                    console.error("")
                    console.error("Oops, something went wrong 😨 Full error is shown above.")
                    console.error("")
                    console.error("If you think this is a bug, please file an issue with full error: https://github.com/PierreBeucher/cloudypad/issues")
                    console.error("")
                    console.error("⚠️ Your instance was not created successfully. To cleanup resources and avoid leaving orphaned resources which may be charged, run:")
                    console.error("")
                    console.error("    cloudypad destroy <instance-name>")

                    await cleanupAndExit(1)
                }
            })
    }

    buildUpdateCommand() {
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_DUMMY)
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
            .option('--instance-type <type>', 'EC2 instance type')
            .action(async (cliArgs: DummyUpdateCliArgs) => {
                
                try {
                    await new InteractiveInstanceUpdater<DummyInstanceStateV1, DummyUpdateCliArgs>({
                        stateParser: new DummyStateParser(),
                        inputPrompter: new DummyInputPrompter()
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Instance update failed', { cause: error })
                }
            })
    }
}