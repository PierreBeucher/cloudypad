import { SshInstanceInput as SshInstanceInput, SshInstanceStateV1 as SshInstanceStateV1, SshProvisionInputV1 as SshProvisionInputV1, SshStateParser } from "./state"
import { CommonConfigurationInputV1, CommonInstanceInput } from "../../core/state/state"
import { select, input, confirm, password } from '@inquirer/prompts';
import { AbstractInputPrompter, PromptOptions } from "../../cli/prompter";
import lodash from 'lodash'
import { CliCommandGenerator, CreateCliArgs, UpdateCliArgs, CLI_OPTION_STREAMING_SERVER, CLI_OPTION_SUNSHINE_PASSWORD, CLI_OPTION_SUNSHINE_USERNAME, CLI_OPTION_SUNSHINE_IMAGE_REGISTRY, CLI_OPTION_SUNSHINE_IMAGE_TAG, CLI_OPTION_AUTO_STOP_TIMEOUT, CLI_OPTION_AUTO_STOP_ENABLE, CLI_OPTION_USE_LOCALE, CLI_OPTION_KEYBOARD_LAYOUT, CLI_OPTION_KEYBOARD_MODEL, CLI_OPTION_KEYBOARD_VARIANT, CLI_OPTION_KEYBOARD_OPTIONS, BuildCreateCommandArgs, BuildUpdateCommandArgs, CLI_OPTION_RATE_LIMIT_MAX_MBPS } from "../../cli/command";
import { CLOUDYPAD_PROVIDER_SSH } from "../../core/const";
import { InteractiveInstanceInitializer } from "../../cli/initializer";
import { PartialDeep } from "type-fest";
import { InteractiveInstanceUpdater } from "../../cli/updater";
import { cleanupAndExit, logFullError } from "../../cli/program";
import { SshProviderClient as SshProviderClient } from "./provider";

export interface SshCreateCliArgs extends CreateCliArgs {
    hostname?: string
    sshUser?: string
    sshPassword?: string
}

export type SshUpdateCliArgs = UpdateCliArgs


export class SshInputPrompter extends AbstractInputPrompter<SshCreateCliArgs, SshProvisionInputV1, CommonConfigurationInputV1> {
    
    buildProvisionerInputFromCliArgs(cliArgs: SshCreateCliArgs): PartialDeep<SshInstanceInput> {
        const input: PartialDeep<SshInstanceInput> = {
            provision: {
                hostname: cliArgs.hostname,
                ssh: {
                    // private key is already handled by CLI args
                    user: cliArgs.sshUser,
                    passwordBase64: cliArgs.sshPassword ? Buffer.from(cliArgs.sshPassword).toString('base64') : undefined
                }
            }
        };

        return input;
    }

    protected async promptSpecificInput(commonInput: CommonInstanceInput, partialInput: PartialDeep<SshInstanceInput>, createOptions: PromptOptions): Promise<SshInstanceInput> {

        if(createOptions.autoApprove !== true) {
            await this.warnExperimentalProvider()
        }

        const hostname = await this.hostname(partialInput.provision?.hostname)
        const sshUser = await this.sshUser(partialInput.provision?.ssh?.user)
        const sshAuth = await this.sshAuth(partialInput)
        
        const localInput: SshInstanceInput = lodash.merge(
            {},
            commonInput, 
            {
                provision: {
                    hostname: hostname,
                    ssh: {
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

    private async sshAuth(partialInput: PartialDeep<SshInstanceInput>): Promise<{
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

                    sshPasswordBase64 = Buffer.from(sshPassword).toString('base64')
                    
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

    private async warnExperimentalProvider(){
        await input({ message: `Please note the SSH provider is EXPERIMENTAL and requires:\n` +
            `- An Ubuntu 22.04 or 24.04 machine with NVIDIA GPU\n` +
            `- SSH access (password or private key) with sudo access\n` +
            `\n` +
            `It's best to use a fresh install of Ubuntu to avoid potential issues with existing NVIDIA drivers, Docker installation or other components` +
            ` which may conflict with Cloudy Pad installation process. Future versions will support more Linux distributions and be more flexible.\n` +
            `\n` +
            `If you encounter problems or have feedback please create an issue on GitHub: https://github.com/PierreBeucher/cloudypad/issues\n` +
            `\n` +
            `Press enter to continue...`,
        })
    }
}

export class SshCliCommandGenerator extends CliCommandGenerator {
    
    buildCreateCommand(args: BuildCreateCommandArgs) {
        return this.getBaseCreateCommand(CLOUDYPAD_PROVIDER_SSH)
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
            .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
            .option('--hostname <hostname>', 'Server IP or hostname on which to deploy the instance')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .action(async (cliArgs: SshCreateCliArgs) => {
                
                try {
                    await new InteractiveInstanceInitializer<SshInstanceStateV1, SshCreateCliArgs>({ 
                        providerClient: new SshProviderClient({ config: args.coreConfig }),
                        inputPrompter: new SshInputPrompter({ coreConfig: args.coreConfig }),
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
        return this.getBaseUpdateCommand(CLOUDYPAD_PROVIDER_SSH)
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
            .addOption(CLI_OPTION_RATE_LIMIT_MAX_MBPS)
            .option('--host <host>', 'Host IP or hostname for SSH connection')
            .option('--ssh-user <user>', 'SSH username')
            .option('--ssh-password <password>', 'SSH password')
            .action(async (cliArgs: SshUpdateCliArgs) => {
                
                try {
                    await new InteractiveInstanceUpdater<SshInstanceStateV1, SshUpdateCliArgs>({
                        providerClient: new SshProviderClient({ config: args.coreConfig }),
                        inputPrompter: new SshInputPrompter({ coreConfig: args.coreConfig }),
                    }).updateInteractive(cliArgs)
                    
                    console.info(`Updated instance ${cliArgs.name}`)
                    
                } catch (error) {
                    throw new Error('Instance update failed', { cause: error })
                }
            })
    }
}