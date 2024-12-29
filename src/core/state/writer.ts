import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { getLogger } from '../../log/utils'
import { StateParser } from './parser'
import { BaseStateManager } from './base-manager'
import { InstanceStateV1 } from './state'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'

export interface StateWriterArgs<ST extends InstanceStateV1> {

    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir?: string

    state: ST
}

/**
 * Manages instance states on disk including reading and writing State to disk
 * and transforming older state version to new state version. 
 * 
 * State are stored in Cloudy Pad data root directory (also called Cloudy Pad home),
 * optionally passed in constructor or using getEnvironmentDataRootDir() by default. 
 * 
 * States are saved un ${dataRootDir}/instances/<instance_name>/state.yaml
 * (also possible to be config.yaml as it was uwed by legacy V0 state)
 * 
 * StateManager will automatically migrate to current state version any State it loads,
 * eg. loading an instance using a V0 state will automatically migrate to V1 state. 
 */
export class StateWriter<ST extends InstanceStateV1> extends BaseStateManager {

    private logger = getLogger(StateWriter.name)

    private state: ST
    
    constructor(args: StateWriterArgs<ST>) {
        super({ dataRootDir: args?.dataRootDir })
        this.state = args.state
    }
    
    private async updateState(unsafeState: ST){

        // Parse to make sure a buggy state isn't persisted to disk
        // Throws error if marlformed state
        const parser = new StateParser()
        parser.parseAnyStateV1(unsafeState)
        const safeState = unsafeState

        this.state = safeState

        const statePath = this.getInstanceStatePath(safeState.name)

        this.logger.debug(`Persisting state for ${safeState.name} at ${statePath}`)
        
        await this.ensureInstanceDirExists()
        fs.writeFileSync(statePath, yaml.dump(safeState), 'utf-8')
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
        await this.updateState(this.state)
    }

    async setProvisionInput(input: ST["provision"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.input = input
        await this.updateState(newState)
    }

    async setProvisionOutput(output?: ST["provision"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.provision.output = output
        await this.updateState(newState)
    }

    async setConfigurationInput(input: ST["configuration"]["input"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.input = input
        await this.updateState(newState)
    }

    async setConfigurationOutput(output?: ST["configuration"]["output"]){
        const newState = lodash.cloneDeep(this.state)
        newState.configuration.output = output
        await this.updateState(newState)
    }

    async updateProvisionInput(input: PartialDeep<ST["provision"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.provision.input, input)
        await this.updateState(newState)
    }
    
    async updateConfigurationInput(input: PartialDeep<ST["configuration"]["input"]>){
        const newState = lodash.cloneDeep(this.state)
        lodash.merge(newState.configuration.input, input)
        await this.updateState(newState)
    }

    /**
     * Effectively destroy instance state and it's directory
     */
    async destroyInstanceStateDirectory(){
        await this.removeInstanceDir()
    }

    private async ensureInstanceDirExists(): Promise<void> {
        const instanceName = this.instanceName()
        const instanceDir = this.getInstanceDir(instanceName)

        if (!fs.existsSync(instanceDir)) {
            this.logger.debug(`Creating instance ${instanceName} directory at ${instanceDir}`)

            fs.mkdirSync(instanceDir, { recursive: true })

            this.logger.debug(`Instance ${instanceName} directory created at ${instanceDir}`)
        } else {
            this.logger.trace(`Instance directory already exists at ${instanceDir}`)
        }
    }

    private async removeInstanceDir(): Promise<void> {
        const instanceName = this.instanceName()
        const confDir = this.getInstanceDir(instanceName)

        this.logger.debug(`Removing instance config directory ${instanceName}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true, force: true })
    }
}