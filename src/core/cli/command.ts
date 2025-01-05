import { Command, Option } from "@commander-js/extra-typings";
import { PUBLIC_IP_TYPE, PUBLIC_IP_TYPE_DYNAMIC, PUBLIC_IP_TYPE_STATIC } from "../const";
import { AnalyticsManager } from "../../tools/analytics/manager";

//
// Common CLI Option each providers can re-use
//

/**
 * Arguments any Provider can take as parameter for create command
 */
export interface CreateCliArgs {
    name?: string
    privateSshKey?: string
    yes?: boolean // auto approve
    overwriteExisting?: boolean
    skipPairing?: boolean
}

/**
 * Arguments any Provider can take as parameter for update command
 */
export type UpdateCliArgs = Omit<CreateCliArgs, "name" | "privateSshKey">


export const CLI_OPTION_INSTANCE_NAME = new Option('--name <name>', 'Instance name')
export const CLI_OPTION_PRIVATE_SSH_KEY = new Option('--private-ssh-key <path>', 'Path to private SSH key to use to connect to instance')
export const CLI_OPTION_AUTO_APPROVE = new Option('--yes', 'Do not prompt for approval, automatically approve and continue')
export const CLI_OPTION_OVERWRITE_EXISTING = new Option('--overwrite-existing', 'If an instance with the same name already exists, override without warning prompt')
export const CLI_OPTION_SPOT = new Option('--spot', 'Enable Spot instance. Spot instances are cheaper (usually 20% to 70% off) but may be restarted any time.')
export const CLI_OPTION_DISK_SIZE = new Option('--disk-size <size>', 'Disk size in GB')
    .argParser(parseInt)
export const CLI_OPTION_PUBLIC_IP_TYPE = new Option('--public-ip-type <type>', `Public IP type. Either ${PUBLIC_IP_TYPE_STATIC} or ${PUBLIC_IP_TYPE_DYNAMIC}`)
    .argParser(parsePublicIpType)
export const CLI_OPTION_SKIP_PAIRING = new Option('--skip-pairing', 'Skip Moonlight pairing after initial provisioning and configuration')

/**
 * Helper to create a Commander CLI sub-commands for create and update commands.
 */
export abstract class CliCommandGenerator {

    protected analytics = AnalyticsManager.get()

    /**
     * Create a base 'create' command for a given provider name with possibilities to chain with additional options.
     */
    protected getBaseCreateCommand(provider: string){
        return new Command(provider)
            .description(`Create a new Cloudy Pad instance using ${provider} provider.`)
            .addOption(CLI_OPTION_INSTANCE_NAME)
            .addOption(CLI_OPTION_PRIVATE_SSH_KEY)
            .addOption(CLI_OPTION_AUTO_APPROVE)
            .addOption(CLI_OPTION_OVERWRITE_EXISTING)
            .addOption(CLI_OPTION_SKIP_PAIRING)
    }

    /**
     * Create a base 'update' command for a given provider name with possibilities to chain with additional options.
     */
    protected getBaseUpdateCommand(provider: string){
        return new Command(provider)
            .description(`Update an existing Cloudy Pad instance using ${provider} provider.`)
            .requiredOption('--name <name>', 'Instance name')
            .addOption(CLI_OPTION_AUTO_APPROVE)
    }

    /**
     * Build a 'create' Command for Commander CLI using provided Command
     */
    abstract buildCreateCommand(): Command<[]>

    /**
     * Build an 'update' Command for Commander CLI using provided Command
     */
    abstract buildUpdateCommand(): Command<[]>

}

export function parsePublicIpType(value: string): PUBLIC_IP_TYPE {
    if (value !== PUBLIC_IP_TYPE_STATIC && value !== PUBLIC_IP_TYPE_DYNAMIC) {
        throw new Error(`Invalid value for --public-ip-type. Either "${PUBLIC_IP_TYPE_STATIC}" or "${PUBLIC_IP_TYPE_DYNAMIC}"`)
    }
    return value
}
