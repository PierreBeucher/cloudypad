import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "../core/const"
import { StateInitializer } from "../core/state/initializer"
import { CommonConfigurationInputV1, CommonProvisionInputV1, InstanceStateV1 } from "./state/state"
import { generatePrivateSshKey } from "../tools/ssh"
import { toBase64 } from "../tools/base64"
import { StateWriter } from "./state/writer"

export interface InstancerInitializerArgs {
    provider: CLOUDYPAD_PROVIDER
    stateWriter: StateWriter<InstanceStateV1>
}

/**
 * Base class for initializing an instance. Can be extended to add custom steps before and after each step using before* and after* methods.
 */
export class InstanceInitializer<PI extends CommonProvisionInputV1, CI extends CommonConfigurationInputV1> {

    protected readonly logger = getLogger(InstanceInitializer.name)
    protected readonly args: InstancerInitializerArgs

    constructor(args: InstancerInitializerArgs){
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
    async initializeStateOnly(instanceName: string, provisionInput: PI, configurationInput: CI): Promise<void> {
        
        this.logger.debug(`Initializing instance with provisionInput ${JSON.stringify(provisionInput)} and configurationInput ${JSON.stringify(configurationInput)}`)
        
        // Check if we are using the auth object for password authentication 
        // (mainly for the dummy provider)
        const usesPasswordAuth = (provisionInput as any).auth && 
                              (provisionInput as any).auth.type === "password";

        // Only generate an SSH key if we are NOT using password authentication
        // and if no key has been specified
        if (!usesPasswordAuth && 
            !provisionInput.ssh.privateKeyPath && 
            !provisionInput.ssh.privateKeyContentBase64) {
            
            const privateKeyContent = generatePrivateSshKey()
            const privateKeyContentBase64 = toBase64(privateKeyContent)
            provisionInput.ssh.privateKeyContentBase64 = privateKeyContentBase64
        }

        const state = await new StateInitializer({
            stateWriter: this.args.stateWriter,
            input: {
                instanceName: instanceName,
                provision: provisionInput,
                configuration: configurationInput
            },
            provider: this.args.provider,
        }).initializeState()
    }
}
