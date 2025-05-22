import { DummyInstanceInput, DummyInstanceStateV1, DummyProvisionInputV1, DummyStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { select, input, confirm } from '@inquirer/prompts';
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import lodash from 'lodash'
import { CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS, BuildCreateCommandArgs, BuildUpdateCommandArgs } from "../../cli/command";
import { CLOUDYPAD_PROVIDER_DUMMY } from "../../core/const";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { cleanupAndExit, logFullError } from "../../cli/program";

export interface DummyCreateCliArgs extends CreateCliArgs {
    instanceType?: string
    startDelaySeconds?: number
    stopDelaySeconds?: number
    configurationDelaySeconds?: number
    provisioningDelaySeconds?: number
    readinessDelaySeconds?: number
    host?: string
    sshUser?: string
    sshPassword?: string
    usePasswordAuth?: boolean
}

export type DummyUpdateCliArgs = UpdateCliArgs


export class DummyInputPrompter extends AbstractInputPrompter<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1> {
    
    buildProvisionerInputFromCliArgs(cliArgs: DummyCreateCliArgs): PartialDeep<DummyInstanceInput> {
        const input: PartialDeep<DummyInstanceInput> = {
            provision: {
                instanceType: cliArgs.instanceType,
                startDelaySeconds: cliArgs.startDelaySeconds,
                stopDelaySeconds: cliArgs.stopDelaySeconds,
                configurationDelaySeconds: cliArgs.configurationDelaySeconds,
                provisioningDelaySeconds: cliArgs.provisioningDelaySeconds,
                readinessAfterStartDelaySeconds: cliArgs.readinessDelaySeconds,
                customHost: cliArgs.host,
            }
        };

        if (cliArgs.usePasswordAuth && cliArgs.sshUser && cliArgs.sshPassword && input.provision) {
            // When using password auth, we MUST NOT include any ssh key properties
            input.provision.auth = {
                type: "password" as const,
                ssh: {
                    user: cliArgs.sshUser,
                    password: cliArgs.sshPassword
                }
            };
            
            // DO NOT add any ssh configuration when using password auth
        } else if (!cliArgs.usePasswordAuth && input.provision) {
            // Regular SSH key-based auth needs the ssh field
            input.provision.ssh = {
                user: cliArgs.sshUser || "ubuntu",
                privateKeyContentBase64: "" // Will be replaced by actual key later
            };
        }

        return input;
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<DummyInstanceInput>, createOptions: PromptOptions): Promise<DummyInstanceInput> {

        const instanceType = await this.instanceType(partialInput.provision?.instanceType)
        
        // Ask if the user wants to use password authentication
        const usePasswordAuth = await confirm({
            message: 'Do you want to use password authentication instead of SSH key?',
            default: partialInput.provision?.auth?.type === "password" ? true : false,
        });
        
        if (usePasswordAuth) {
            // If we use password authentication
            const customHost = await input({
                message: 'Enter IP address or hostname:',
                default: partialInput.provision?.customHost || '',
            });
            
            // Safe access to nested properties
            const defaultUser = partialInput.provision?.auth?.type === "password" && 
                               partialInput.provision?.auth?.ssh?.user ? 
                               partialInput.provision.auth.ssh.user : 
                               'ubuntu';
            
            const sshUser = await input({
                message: 'Enter SSH username:',
                default: defaultUser,
            });
            
            // Safe access to nested properties
            const defaultPassword = partialInput.provision?.auth?.type === "password" && 
                                  partialInput.provision?.auth?.ssh?.password ? 
                                  partialInput.provision.auth.ssh.password : 
                                  '';
            
            const sshPassword = await input({
                message: 'Enter SSH password:',
                default: defaultPassword,
            });
            
            const auth = {
                type: "password" as const,
                ssh: {
                    user: sshUser,
                    password: sshPassword
                }
            };
            
            // Create a copy of commonInput without ssh properties to avoid validation errors
            const { provision, ...restCommonInput } = lodash.cloneDeep(commonInput);
            const { ssh, ...restProvision } = provision || {};
            
            const dummyInput: DummyInstanceInput = lodash.merge(
                {},
                { ...restCommonInput, provision: restProvision }, 
                {
                    provision:{
                        instanceType: instanceType,
                        startDelaySeconds: partialInput.provision?.startDelaySeconds ?? 10,
                        stopDelaySeconds: partialInput.provision?.stopDelaySeconds ?? 10,
                        configurationDelaySeconds: partialInput.provision?.configurationDelaySeconds ?? 0,
                        provisioningDelaySeconds: partialInput.provision?.provisioningDelaySeconds ?? 0,
                        readinessAfterStartDelaySeconds: partialInput.provision?.readinessAfterStartDelaySeconds ?? 0,
                        initialServerStateAfterProvision: partialInput.provision?.initialServerStateAfterProvision ?? "running",
                        customHost: customHost,
                        auth: auth
                    }
                })
            
            return dummyInput;
        } else {
            // If we use SSH key (default)
            const dummyInput: DummyInstanceInput = lodash.merge(
                {},
                commonInput, 
                {
                    provision:{
                        instanceType: instanceType,
                        startDelaySeconds: partialInput.provision?.startDelaySeconds ?? 10,
                        stopDelaySeconds: partialInput.provision?.stopDelaySeconds ?? 10,
                        configurationDelaySeconds: partialInput.provision?.configurationDelaySeconds ?? 0,
                        provisioningDelaySeconds: partialInput.provision?.provisioningDelaySeconds ?? 0,
                        readinessAfterStartDelaySeconds: partialInput.provision?.readinessAfterStartDelaySeconds ?? 0,
                        initialServerStateAfterProvision: partialInput.provision?.initialServerStateAfterProvision ?? "running",
                    }
                })
            
            return dummyInput
        }
    }

    private async instanceType(instanceType?: string): Promise<string> {

        if (instanceType) {
            return instanceType;
        }

        const choices = [{
            name: "Local (run on this machine)",
            value: "local"
        }]

        const selectedInstanceType = await select({
            message: 'Choose an instance type:',
            default: "local",
            choices: choices,
            loop: false,
        })

        
        return selectedInstanceType        
    }
    
}

export class DummyCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
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
            .option('--host <host>', 'Host IP or hostname for SSH connection')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .option('--use-password-auth', 'Use password authentication instead of SSH key', false)
            .action(async (cliArgs: DummyCreateCliArgs) => {
                
                try {
                    await new InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1>({ 
                        coreClient: args.coreClient,
                        inputPrompter: new DummyInputPrompter({ coreClient: args.coreClient }),
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

    buildUpdateCommand(args: BuildUpdateCommandArgs) {
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
            .option('--host <host>', 'Host IP or hostname for SSH connection')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .option('--use-password-auth', 'Use password authentication instead of SSH key', false)
            .action(async (cliArgs: DummyUpdateCliArgs) => {
                
                try {
                    await new InteractiveInstanceUpdater<DummyInstanceStateV1, DummyUpdateCliArgs>({
                        coreClient: args.coreClient,
                        stateParser: new DummyStateParser(),
                        inputPrompter: new DummyInputPrompter({ coreClient: args.coreClient }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Instance update failed', { cause: error })
                }
            })
    }
}