import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { getLogger } from '../../log/utils'
import { InstanceStateV1 } from './state'
import { StateMigrator } from './migrator'
import { AnyInstanceStateV1, StateParser } from './parser'

/**
 * Return current environments Cloudy Pad data root dir, by order of priority:
 * - $CLOUDYPAD_HOME environment variable
 * - $HOME/.cloudypad
 * - Fails is neither CLOUDYPAD_HOME nor HOME is set
 * 
 * This function is used by all components with side effects in Cloudy Pad data root dir (aka Cloudy Pad Home)
 * and can be mocked during tests to control side effect
 */
export function getEnvironmentDataRootDir(): string {
    if (process.env.CLOUDYPAD_HOME) {
        return process.env.CLOUDYPAD_HOME
    } else {
        if (!process.env.HOME){
            throw new Error("Neither CLOUDYPAD_HOME nor HOME environment variable is set. Could not define Cloudy Pad data root directory.")
        }

        return path.resolve(`${ process.env.HOME}/.cloudypad`)
    }
}


export interface StateManagerArgs {

    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir?: string
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
export class StateManager {

    static default(): StateManager{
        return new StateManager()
    }

    private logger = getLogger(StateManager.name)

    private dataRootDir: string 

    private parser = new StateParser()

    constructor(args?: StateManagerArgs) {
        this.dataRootDir = args?.dataRootDir ?? getEnvironmentDataRootDir()
    }
    
    getDataRootDir(){
        return this.dataRootDir
    }

    getInstanceDir(instanceName: string): string {
        return path.join(this.dataRootDir, 'instances', instanceName)
    }

    getInstanceStateV1Path(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "state.yml")
    }

    getInstanceStateV0Path(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "config.yml")
    }

    async removeInstanceStateV0(instanceName: string) {
        const instanceStateV0Path = this.getInstanceStateV0Path(instanceName)
        fs.rmSync(instanceStateV0Path)
    }

    listInstances(): string[] {
        try {
            const allInstancesDirPath = path.join(this.dataRootDir, 'instances')
            this.logger.debug(`Listing all instances from ${allInstancesDirPath}`)

            const instanceNames = fs.readdirSync(allInstancesDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter(instanceName => this.instanceExists(instanceName))

            return instanceNames
        } catch (error) {
            this.logger.error('Failed to read instances directory:', error)
            return []
        }
    }

    /**
     * Check an instance exists. An instance is considering existing if the folder
     * ${dataRootDir}/instances/<instance_name> exists and contains a state. 
     */
    async instanceExists(instanceName: string): Promise<boolean> {
        const instanceDir = this.getInstanceDir(instanceName)

        this.logger.debug(`Checking instance ${instanceName} exists at ${instanceDir}`)

        const instanceStateV0Path = this.getInstanceStateV0Path(instanceName)
        const instanceStateV1Path = this.getInstanceStateV1Path(instanceName)

        return fs.existsSync(instanceDir) && 
            (fs.existsSync(instanceStateV1Path) || fs.existsSync(instanceStateV0Path))
    }

    /**
     * Load raw instance state from disk. Loaded state is NOT type-checked.
     * First try to load state V1, then State V0 before failing
     */
    private async loadRawInstanceState(instanceName: string): Promise<unknown> {
        this.logger.debug(`Loading instance state ${instanceName}`)

        if (!(await this.instanceExists(instanceName))) {
            throw new Error(`Instance named '${instanceName}' does not exist.`)
        }

        
        const instanceStateV1Path = this.getInstanceStateV1Path(instanceName)
        if(fs.existsSync(instanceStateV1Path)) {
            
            this.logger.debug(`Loading instance V1 state for ${instanceName} at ${instanceStateV1Path}`)
            return yaml.load(fs.readFileSync(instanceStateV1Path, 'utf8'))

        } else {
            this.logger.debug(`Instance state V1 for ${instanceName} not found, trying to load V0 state`)
            const instanceStateV0Path = this.getInstanceStateV0Path(instanceName)

            if(fs.existsSync(instanceStateV0Path)) {
                this.logger.debug(`Loading instance V0 state for ${instanceName} at ${instanceStateV0Path}`)
                return yaml.load(fs.readFileSync(instanceStateV0Path, 'utf8'))
            } else {
                throw new Error(`Neither state V0 nor V1 found for instancce ${instanceName}`)
            }
        }
    }

    /**
     * Safely load an instance state from disk:
     * - Check for state version and migrate if needed
     * - (soon) Validate state with Zod
     */
    async loadInstanceStateSafe(instanceName: string): Promise<AnyInstanceStateV1> {
        // state is unchecked, any is acceptable at this point
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawState = await this.loadRawInstanceState(instanceName) as any

        // to discriminate between Zod-ready state V1 and legacy V0 check for the "version" field
        // if absent, state is V0 and should be migrated to V1
        // if present, state is V1 and should be verified with Zod
        //
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rawStateV1: any 
        if(!rawState.version){
            this.logger.debug(`Instance state V0 detected for ${instanceName}. Migrating to V1...`)
            rawStateV1 = await new StateMigrator().migrateStateV0toV1(rawState)

            // Data migration done.
            // Remove legacy state file and persist new one

            this.logger.debug(`V0 to V1 migration: Persisting new state file for ${instanceName}...`)
            await this.persistState(rawStateV1) 

            this.logger.debug(`V0 to V1 migration: Deleting old V0 state file for ${instanceName}...`)
            await this.removeInstanceStateV0(instanceName)
        
        } else {
            rawStateV1 = rawState
        }

        if(rawStateV1.version != "1") {
            throw new Error(`Unknown state version '${rawStateV1.version}'`)
        }

        return this.parser.parseAnyStateV1(rawStateV1)
    }

    /**
     * Persist state on disk. Verify the persisted state matches expeced structure for safety
     * to avoid writing something we won't be able to load. 
     */
    async persistState(state: InstanceStateV1): Promise<void> {

        const safeState = this.parser.parseAnyStateV1(state)

        await this.ensureInstanceDirExists(safeState.name)

        const statePath = this.getInstanceStateV1Path(safeState.name)

        this.logger.debug(`Persisting state for ${safeState.name} at ${statePath}`)

        fs.writeFileSync(statePath, yaml.dump(safeState), 'utf-8')
    }

    private async ensureInstanceDirExists(instanceName: string): Promise<void> {
        const instanceDir = this.getInstanceDir(instanceName)

        if (!fs.existsSync(instanceDir)) {
            this.logger.debug(`Creating instance ${instanceName} directory at ${instanceDir}`)

            fs.mkdirSync(instanceDir, { recursive: true })

            this.logger.debug(`Instance ${instanceName} directory created at ${instanceDir}`)
        } else {
            this.logger.trace(`Instance directory already exists at ${instanceDir}`)
        }
    }

    async removeInstanceDir(instanceName: string): Promise<void> {
        const confDir = this.getInstanceDir(instanceName)

        this.logger.debug(`Removing instance config directory ${instanceName}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true, force: true })
    }
}