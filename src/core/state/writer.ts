import { getLogger } from '../../log/utils'
import { InstanceStateV1 } from './state'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'
import { StateSideEffect } from './side-effects/abstract'

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

    private state: ST

    public readonly sideEffect: StateSideEffect
    
    constructor(args: StateWriterArgs<ST>) {
        this.state = args.state
        this.sideEffect = args.sideEffect
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
        await this.sideEffect.persistState(this.state)
    }

    async setProvisionInput(input: ST["provision"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.input = input
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    async setProvisionOutput(output?: ST["provision"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.output = output
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    async setConfigurationInput(input: ST["configuration"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.input = input
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    async setConfigurationOutput(output?: ST["configuration"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.output = output
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    async updateProvisionInput(input: PartialDeep<ST["provision"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.provision.input, input)
        await this.sideEffect.persistState(newState)
        this.state = newState
    }
    
    async updateConfigurationInput(input: PartialDeep<ST["configuration"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.configuration.input, input)
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    async destroyState(){
        this.sideEffect.destroyState(this.instanceName())
    }
}