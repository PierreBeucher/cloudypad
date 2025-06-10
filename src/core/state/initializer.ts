import { InstanceInputs, InstanceEventEnum, InstanceStateV1 } from './state';
import { getLogger } from '../../log/utils';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER } from '../const';
import { StateWriter } from './writer';
import { GenericStateParser } from './parser';

export interface StateInitializerArgs<ST extends InstanceStateV1> {
    stateWriter: StateWriter<ST>,
    stateParser: GenericStateParser<ST>,
    provider: CLOUDYPAD_PROVIDER,
    input: InstanceInputs<ST["provision"]["input"], ST["configuration"]["input"]>,
}

export class StateInitializer<ST extends InstanceStateV1> {

    protected readonly logger = getLogger(StateInitializer.name)

    protected readonly args: StateInitializerArgs<ST>
    
    constructor(args: StateInitializerArgs<ST>){
        this.args = args
    }

    public async initializeState(): Promise<ST> {

        const instanceName = this.args.input.instanceName
        const input = this.args.input

        this.logger.debug(`Initializing a new instance with config ${JSON.stringify(input)}`)

        const initialConfig: ST["configuration"] = {
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
            input: input.configuration,
            output: undefined
        }

        const initialProvision: ST["provision"] = {
            provider: this.args.provider,
            input: input.provision,
            output: undefined
        }
        
        // Create the initial state and parse it back
        // It's required to use a Parser here since Typescript won't allow
        // affectcation of newState: ST = { ... } directly
        // See https://stackoverflow.com/questions/56505560/how-to-fix-ts2322-could-be-instantiated-with-a-different-subtype-of-constraint
        const initialStateRaw: InstanceStateV1 = {
            name: instanceName,
            events: [],
            version: "1",
            provision: initialProvision,
            configuration: initialConfig
        }

        const initialState = this.args.stateParser.parse(initialStateRaw)

        await this.args.stateWriter.setState(initialState)
        await this.args.stateWriter.addEvent(instanceName, InstanceEventEnum.Init)

        return initialState
    }

}