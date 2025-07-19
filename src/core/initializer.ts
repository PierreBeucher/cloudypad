import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "../core/const"
import { StateInitializer } from "../core/state/initializer"
import { InstanceStateV1 } from "./state/state"
import { generatePrivateSshKey } from "../tools/ssh"
import { toBase64 } from "../tools/base64"
import { StateWriter } from "./state/writer"
import { GenericStateParser } from "./state/parser"

export interface InstanceInitializerArgs<ST extends InstanceStateV1> {
    provider: CLOUDYPAD_PROVIDER
    stateWriter: StateWriter<ST>
    stateParser: GenericStateParser<ST>
}

/**
 * Base class for initializing an instance. Can be extended to add custom steps before and after each step using before* and after* methods.
 */
export class InstanceInitializer<ST extends InstanceStateV1> {

    protected readonly logger = getLogger(InstanceInitializer.name)
    protected readonly args: InstanceInitializerArgs<ST>

    constructor(args: InstanceInitializerArgs<ST>){
        this.args = args
    }

    /**
     * Initialize an instance using the provided inputs.
     * 
     * If neither SSH key path nor SSH key content is provided, the key will be generated and stored in the instance state.
     * 
     * @param instanceName 
     * @param provisionInput 
     * @param configurationInput 
     */
    async initializeStateOnly(instanceName: string, provisionInput: ST["provision"]["input"], configurationInput: ST["configuration"]["input"]): Promise<void> {
        
        this.logger.debug(`Initializing instance with provisionInput ${JSON.stringify(provisionInput)} and configurationInput ${JSON.stringify(configurationInput)}`)
        
        // Generate SSH private key if no other auth method is provided
        if (!provisionInput.ssh.privateKeyPath && 
            !provisionInput.ssh.privateKeyContentBase64 && 
            !provisionInput.ssh.passwordBase64
        ) {
            const privateKeyContent = generatePrivateSshKey()
            const privateKeyContentBase64 = toBase64(privateKeyContent)
            provisionInput.ssh.privateKeyContentBase64 = privateKeyContentBase64
        }

        const state = await new StateInitializer({
            stateWriter: this.args.stateWriter,
            stateParser: this.args.stateParser,
            input: {
                instanceName: instanceName,
                provision: provisionInput,
                configuration: configurationInput
            },
            provider: this.args.provider,
        }).initializeState()
    }
}
