import { getLogger } from '../../log/utils'
import { InstanceStateV1 } from './state'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'
import { StateSideEffect } from './side-effect'

export interface StateWriterArgs<ST extends InstanceStateV1> {

    /**
     * Side effect to write instance state
     */
    sideEffect: StateSideEffect

    state: ST
}

/**
 * Manages instance state writes using a side effect.
 */
export class StateWriter<ST extends InstanceStateV1> {

    protected logger = getLogger(StateWriter.name)

    private readonly args: StateWriterArgs<ST>

    private state: ST
    
    constructor(args: StateWriterArgs<ST>) {
        this.args = args
        this.state = args.state
    }

    /**
     * @returns instance name for managed State
     */
    instanceName(): string {
        return this.state.name
    }

    /**
     * Return a clone of managed State.
     */
    cloneState(): ST {
        return lodash.cloneDeep(this.state)
    }
    
    /**
     * Persist managed State on disk.
     */
    async persistStateNow(){
        await this.args.sideEffect.persistState(this.state)
    }

    async setProvisionInput(input: ST["provision"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.input = input
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }

    async setProvisionOutput(output?: ST["provision"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.output = output
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }

    async setConfigurationInput(input: ST["configuration"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.input = input
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }

    async setConfigurationOutput(output?: ST["configuration"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.output = output
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }

    async updateProvisionInput(input: PartialDeep<ST["provision"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.provision.input, input)
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }
    
    async updateConfigurationInput(input: PartialDeep<ST["configuration"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.configuration.input, input)
        await this.args.sideEffect.persistState(newState)
        this.state = newState
    }

    async destroyState(){
        this.args.sideEffect.destroyState(this.instanceName())
    }
}