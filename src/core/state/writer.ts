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
}

/**
 * Manages instance state writes using a side effect.
 */
export class StateWriter<ST extends InstanceStateV1> {

    protected logger = getLogger(StateWriter.name)

    private state?: ST

    public readonly sideEffect: StateSideEffect
    
    constructor(args: StateWriterArgs<ST>) {
        this.sideEffect = args.sideEffect
    }

    setState(state: ST){
        this.state = state
    }

    getState(): ST {
        if(!this.state) throw new Error("State not set. Has this StateWriter been initialized with setState()?")
        return this.state
    }

    /**
     * @returns instance name for managed State
     */
    instanceName(): string {
        return this.getState().name
    }

    /**
     * Return a clone of managed State.
     */
    cloneState(): ST {
        return lodash.cloneDeep(this.getState())
    }
    
    /**
     * Persist managed State and update current state field.
     */
    private async persistState(newState: ST){
        await this.sideEffect.persistState(newState)
        this.state = newState
    }

    /**
     * Persist managed State on disk.
     */
    async persistStateNow(){
        await this.sideEffect.persistState(this.getState())
    }

    async setProvisionInput(input: ST["provision"]["input"]){
        const newState = lodash.cloneDeep(this.getState())
        newState.provision.input = input
        await this.persistState(newState)
    }

    async setProvisionOutput(output?: ST["provision"]["output"]){
        const newState = lodash.cloneDeep(this.getState())
        newState.provision.output = output
        await this.persistState(newState)
    }

    async setConfigurationInput(input: ST["configuration"]["input"]){
        const newState = lodash.cloneDeep(this.getState())
        newState.configuration.input = input
        await this.persistState(newState)
    }

    async setConfigurationOutput(output?: ST["configuration"]["output"]){
        const newState = lodash.cloneDeep(this.getState())
        newState.configuration.output = output
        await this.persistState(newState)
    }

    async updateProvisionInput(input: PartialDeep<ST["provision"]["input"]>){
        const newState = lodash.cloneDeep(this.getState())
        lodash.merge(newState.provision.input, input)
        await this.persistState(newState)
    }
    
    async updateConfigurationInput(input: PartialDeep<ST["configuration"]["input"]>){
        const newState = lodash.cloneDeep(this.getState())
        lodash.merge(newState.configuration.input, input)
        await this.persistState(newState)
    }

    async destroyState(){
        this.sideEffect.destroyState(this.instanceName())
    }
}