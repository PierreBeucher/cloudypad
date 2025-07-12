import { LocalInstanceInput, LocalInstanceStateV1, LocalProvisionInputV1, LocalStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { select, input, confirm, password } from '@inquirer/prompts';
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import lodash from 'lodash'
import { CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS, BuildCreateCommandArgs, BuildUpdateCommandArgs } from "../../cli/command";
import { CLOUDYPAD_PROVIDER_LOCAL } from "../../core/const";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { cleanupAndExit, logFullError } from "../../cli/program";
import { LocalProviderClient } from "./provider";

export interface LocalCreateCliArgs extends CreateCliArgs {
    hostname?: string
    sshUser?: string
    sshPassword?: string
}

export type LocalUpdateCliArgs = UpdateCliArgs


export class LocalInputPrompter extends AbstractInputPrompter<LocalCreateCliArgs, LocalProvisionInputV1, CommonConfigurationInputV1> {
    
    buildProvisionerInputFromCliArgs(cliArgs: LocalCreateCliArgs): PartialDeep<LocalInstanceInput> {
        const input: PartialDeep<LocalInstanceInput> = {
            provision: {
                ssh: {
                    // private key is already handled by CLI args
                    hostname: cliArgs.hostname,
                    user: cliArgs.sshUser,
                    passwordBase64: cliArgs.sshPassword ? Buffer.from(cliArgs.sshPassword).toString('base64') : undefined
                }
            }
        };

        return input;
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<LocalInstanceInput>, createOptions: PromptOptions): Promise<LocalInstanceInput> {

        const hostname = await this.hostname(partialInput.provision?.ssh?.hostname)
        const sshUser = await this.sshUser(partialInput.provision?.ssh?.user)
        const sshAuth = await this.sshAuth(partialInput)
        
        const localInput: LocalInstanceInput = lodash.merge(
            {},
            commonInput, 
            {
                provision: {
                    ssh: {
                        hostname: hostname,
                        user: sshUser,
                        privateKeyPath: sshAuth.sshPrivateKeyPath,
                        privateKeyContentBase64: sshAuth.sshKeyContentBase64,
                        passwordBase64: sshAuth.sshPasswordBase64
                    }
                }
            })
        
        return localInput;
    }
    
    private async hostname(hostname?: string): Promise<string> {
        if (hostname) {
            return hostname
        }

        return await input({
            message: 'Your machine IP address or hostname:',
        })
    }

    private async sshUser(sshUser?: string): Promise<string> {
        if (sshUser) {
            return sshUser
        }

        return await input({
            message: 'SSH username:',
            default: 'ubuntu'
        })
    }

    private async sshAuth(partialInput: PartialDeep<LocalInstanceInput>): Promise<{
        sshPrivateKeyPath: string | undefined
        sshPasswordBase64: string | undefined
        sshKeyContentBase64: string | undefined
    }> {
        
        // Prompt for authentication method choice unless password or private key is provided
        let sshPrivateKeyPath: string | undefined
        let sshPasswordBase64: string | undefined
        let sshKeyContentBase64: string | undefined

        if(partialInput.provision?.ssh?.privateKeyPath) {
            sshPrivateKeyPath = partialInput.provision.ssh.privateKeyPath
        } else if(partialInput.provision?.ssh?.privateKeyContentBase64) {
            sshKeyContentBase64 = partialInput.provision.ssh.privateKeyContentBase64
        } else if(partialInput.provision?.ssh?.passwordBase64) {
            sshPasswordBase64 = partialInput.provision.ssh.passwordBase64
        } else {
            const authMethod = await select({
                message: 'Choose authentication method:',
                choices: [
                    { name: 'SSH Private Key', value: 'privateKey' },
                    { name: 'Password', value: 'password' }
                ],
                default: 'privateKey'
            })

            if(authMethod === 'privateKey') {

                // TODO list all private keys in ~/.ssh and let user enter custom path

                sshPrivateKeyPath = await input({
                    message: 'Enter path to SSH private key:',
                })
            } else if(authMethod === 'password') {
                let sshPassword = '';
                let confirmedPassword = '';
                
                do {
                    sshPassword = await password({
                        message: 'Enter SSH password:',
                    });
                    
                    confirmedPassword = await password({
                        message: 'Confirm SSH password:',
                    });
                    
                    if (sshPassword !== confirmedPassword) {
                        console.error('Passwords do not match, please try again.');
                    }
                    
                } while (sshPassword !== confirmedPassword);
                
            } else {
                throw new Error('Invalid authentication method')
            }
        }

        return {
            sshPrivateKeyPath,
            sshPasswordBase64,
            sshKeyContentBase64
        }
    }
}

export class LocalCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_LOCAL)
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
            .option('--host <host>', 'Host IP or hostname for SSH connection')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .action(async (cliArgs: LocalCreateCliArgs) => {
                
                try {
                    await new InteractiveInstanceInitializer<LocalInstanceStateV1, LocalCreateCliArgs>({ 
                        providerClient: new LocalProviderClient({ config: args.coreConfig }),
                        inputPrompter: new LocalInputPrompter({ coreConfig: args.coreConfig }),
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
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_LOCAL)
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
            .option('--host <host>', 'Host IP or hostname for SSH connection')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .action(async (cliArgs: LocalUpdateCliArgs) => {
                
                try {
                    await new InteractiveInstanceUpdater<LocalInstanceStateV1, LocalUpdateCliArgs>({
                        providerClient: new LocalProviderClient({ config: args.coreConfig }),
                        inputPrompter: new LocalInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Instance update failed', { cause: error })
                }
            })
    }
}