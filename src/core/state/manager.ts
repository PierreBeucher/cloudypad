import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { getLogger } from '../../log/utils'
import { AnyInstanceStateV1, CommonProvisionConfigV1, CommonProvisionOutputV1, InstanceStateV1 } from './state'
import { StateMigrator } from './migrator'

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
 * Manages instance states on disk
 * including reading and writing State to disk
 * and transforming older state version to new state version
 */
export class StateManager {

    static default(): StateManager{
        return new StateManager()
    }

    private logger = getLogger(StateManager.name)

    private dataRootDir: string 

    constructor(args?: StateManagerArgs) {
        this.dataRootDir = args?.dataRootDir ?? getEnvironmentDataRootDir()
    }
    
    getDataRootDir(){
        return this.dataRootDir
    }

    getInstanceDir(instanceName: string): string {
        return path.join(this.dataRootDir, 'instances', instanceName)
    }

    getInstanceConfigPath(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "config.yml")
    }

    listInstances(): string[] {
        try {
            const instancesDirPath = path.join(this.dataRootDir, 'instances')
            this.logger.debug(`Listing all instances from ${instancesDirPath}`)

            const instanceDirs = fs.readdirSync(instancesDirPath)

            return instanceDirs.filter(dir =>
                fs.existsSync(path.join(instancesDirPath, dir, 'config.yml'))
            )
        } catch (error) {
            this.logger.error('Failed to read instances directory:', error)
            return []
        }
    }

    async instanceExists(instanceName: string): Promise<boolean> {
        const instanceDir = this.getInstanceDir(instanceName)

        this.logger.debug(`Checking instance ${instanceName} exists at ${instanceDir}`)

        return fs.existsSync(instanceDir)
    }

    async loadInstanceState(instanceName: string): Promise<AnyInstanceStateV1> {
        this.logger.debug(`Loading instance state ${instanceName}`)

        if (!(await this.instanceExists(instanceName))) {
            throw new Error(`Instance named '${instanceName}' does not exist.`)
        }

        const configPath = this.getInstanceConfigPath(instanceName)

        this.logger.debug(`Loading instance state ${instanceName} from ${configPath}`)

        const rawState = yaml.load(fs.readFileSync(configPath, 'utf8'))

        const stateMigrator = new StateMigrator()
        const stateV1 = await stateMigrator.ensureStateV1(rawState)
        return stateV1
    }

    async persistState<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1>(state: InstanceStateV1<C, O>): Promise<void> {
        await this.ensureInstanceDirExists(state.name)

        const confPath = this.getInstanceConfigPath(state.name)

        this.logger.debug(`Persisting state for ${state.name} at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(state), 'utf-8')
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