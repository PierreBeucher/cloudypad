import { getLogger } from "../log/utils"
import { CLOUDYPAD_PROVIDER } from "../core/const"
import { StateInitializer } from "../core/state/initializer"
import { CommonConfigurationInputV1, CommonProvisionInputV1 } from "./state/state"
import { generatePrivateSshKey } from "../tools/ssh"
import { toBase64 } from "../tools/base64"
import { InstanceManagerBuilder } from "./manager-builder"

export interface InstancerInitializerArgs {
    provider: CLOUDYPAD_PROVIDER
}

/**
 * Base class for initializing an instance. Can be extended to add custom steps before and after each step using before* and after* methods.
 */
export class InstanceInitializer<PI extends CommonProvisionInputV1, CI extends CommonConfigurationInputV1> {

    protected readonly provider: CLOUDYPAD_PROVIDER
    protected readonly logger = getLogger(InstanceInitializer.name)

    constructor(args: InstancerInitializerArgs){
        this.provider = args.provider
    }

    async initializeAndDeploy(instanceName: string, provisionInput: PI, configurationInput: CI): Promise<void> {
        await this.initializeStateOnly(instanceName, provisionInput, configurationInput)
        
        const manager = await InstanceManagerBuilder.get().buildInstanceManager(instanceName)
        await manager.deploy()
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
        
        // Generate private SSH key if one is not already provided
        if(!provisionInput.ssh.privateKeyPath && !provisionInput.ssh.privateKeyContentBase64){
            const privateKeyContent = generatePrivateSshKey()
            const privateKeyContentBase64 = toBase64(privateKeyContent)
            provisionInput.ssh.privateKeyContentBase64 = privateKeyContentBase64
        }

        const state = await new StateInitializer({
            input: {
                instanceName: instanceName,
                provision: provisionInput,
                configuration: configurationInput
            },
            provider: this.provider,
        }).initializeState()
    }
}
