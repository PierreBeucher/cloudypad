import { CommonInstanceInput, InstanceStateV1 } from './state';
import { getLogger } from '../../log/utils';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER } from '../const';
import { StateManager } from './manager';
import { confirm } from '@inquirer/prompts';

export interface StateInitializerArgs {
    provider: CLOUDYPAD_PROVIDER,
    input: CommonInstanceInput,
    overwriteExisting?: boolean
}

export class StateInitializer {

    protected readonly logger = getLogger(StateInitializer.name)

    protected readonly args: StateInitializerArgs
    protected stateManager: StateManager

    constructor(args: StateInitializerArgs){
        this.args = args
        this.stateManager = StateManager.default()
    }

    /**
     * Initialize instance:
     * - Prompt for common and provisioner-specific configs
     * - Initialize state
     * - Run provision
     * - Run configuration
     * - Optionally pair instance
     * @param opts 
     */
    public async initializeState(): Promise<InstanceStateV1>{

        const instanceName = this.args.input.instanceName
        const input = this.args.input

        if(await this.stateManager.instanceExists(instanceName) && !this.args.overwriteExisting){
            const confirmAlreadyExists = await confirm({
                message: `Instance ${instanceName} already exists. Do you want to overwrite existing instance config?`,
                default: false,
            })
            
            if (!confirmAlreadyExists) {
                throw new Error("Won't overwrite existing instance. Initialization aborted.")
            }
        }

        this.logger.debug(`Initializing a new instance with config ${JSON.stringify(input)}`)

        // Create the initial state
        const initialState: InstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: this.args.provider,
                input: input.provision,
                output: undefined
            },
            configuration: {
                configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                input: input.configuration,
                output: undefined,
            }
        }

        return initialState
    }

}