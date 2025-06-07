import { getLogger } from '../../log/utils'
import { InstanceEventEnum, InstanceStateV1, STATE_MAX_EVENTS } from './state'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'
import { StateSideEffect } from './side-effects/abstract'
import { GenericStateParser } from './parser'

export interface StateWriterArgs<ST extends InstanceStateV1> {

    /**
     * Side effect to write instance state
     */
    sideEffect: StateSideEffect

    /**
     * Parser to parse instance state
     */
    stateParser: GenericStateParser<ST>
}

/**
 * Manages instance state writes using a side effect.
 * Every update on state causes a side effect:
 * - Read current state (side effect)
 * - Perform desired update on current state
 * - Persist state (side effect)
 */
export class StateWriter<ST extends InstanceStateV1> {

    private readonly logger = getLogger(StateWriter.name)
    public readonly args: StateWriterArgs<ST>
    
    constructor(args: StateWriterArgs<ST>) {
        this.args = args
    }

    /**
     * Set the managed State and persist now. Override previous state as-is without any other side effect. 
     */
    // TODO rename setState to match with older function
    async setStateAndPersistNow(state: ST){
        await this.args.sideEffect.persistState(state)
    }

    /**
     * Get the current state by reading it from side effect.
     */
    async getCurrentState(instanceName: string): Promise<ST> {
        const state = await this.args.sideEffect.loadRawInstanceState(instanceName)
        return this.args.stateParser.parse(state)
    }

    // TODO rename getCurrentState to match with older function
    async cloneState(instanceName: string): Promise<ST> {
        const state = await this.getCurrentState(instanceName)
        return state
    }

    async setProvisionInput(instanceName: string, input: ST["provision"]["input"]){
        const newState = await this.getCurrentState(instanceName)
        newState.provision.input = input
        await this.args.sideEffect.persistState(newState)
    }

    async setProvisionOutput(instanceName: string, output?: ST["provision"]["output"]){
        const newState = await this.getCurrentState(instanceName)
        newState.provision.output = output
        await this.args.sideEffect.persistState(newState)
    }

    async setConfigurationInput(instanceName: string, input: ST["configuration"]["input"]){
        const newState = await this.getCurrentState(instanceName)
        newState.configuration.input = input
        await this.args.sideEffect.persistState(newState)
    }

    async setConfigurationOutput(instanceName: string, output?: ST["configuration"]["output"]){
        const newState = await this.getCurrentState(instanceName)
        newState.configuration.output = output
        await this.args.sideEffect.persistState(newState)
    }

    async updateProvisionInput(instanceName: string, input: PartialDeep<ST["provision"]["input"]>){
        const newState = await this.getCurrentState(instanceName)
        lodash.merge(newState.provision.input, input)
        await this.args.sideEffect.persistState(newState)
    }
    
    async updateConfigurationInput(instanceName: string, input: PartialDeep<ST["configuration"]["input"]>){
        const newState = await this.getCurrentState(instanceName)
        lodash.merge(newState.configuration.input, input)
        await this.args.sideEffect.persistState(newState)
    }

    /**
     * Add an event to the state with optional date.
     * @param event Event to add
     * @param atDate Date of event, defaults to current date
     */
    async addEvent(instanceName: string, event: InstanceEventEnum, atDate?: Date){
        const newState = await this.getCurrentState(instanceName)
        if(!newState.events) newState.events = []

        // if more than MAX events, remove oldest event
        // sort events by date and remove oldest
        if(newState.events.length >= STATE_MAX_EVENTS){
            newState.events.sort((a, b) => a.timestamp - b.timestamp)
            newState.events.shift()
        }

        newState.events.push({
            type: event,
            timestamp: atDate ? atDate.getTime() : Date.now()
        })
        await this.args.sideEffect.persistState(newState)
    }

    async destroyState(instanceName: string){
        await this.args.sideEffect.destroyState(instanceName)
    }
}