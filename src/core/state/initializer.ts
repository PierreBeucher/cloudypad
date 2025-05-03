import { CommonInstanceInput, InstanceStateV1 } from './state';
import { getLogger } from '../../log/utils';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER } from '../const';
import { StateWriter } from './writer';

export interface StateInitializerArgs {
    stateWriter: StateWriter<InstanceStateV1>
    provider: CLOUDYPAD_PROVIDER,
    input: CommonInstanceInput,
}

export class StateInitializer {

    protected readonly logger = getLogger(StateInitializer.name)

    protected readonly args: StateInitializerArgs
    
    constructor(args: StateInitializerArgs){
        this.args = args
    }

    public async initializeState(): Promise<InstanceStateV1> {

        const instanceName = this.args.input.instanceName
        const input = this.args.input

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

        this.args.stateWriter.setState(initialState)
        await this.args.stateWriter.persistStateNow()

        return initialState
    }

}