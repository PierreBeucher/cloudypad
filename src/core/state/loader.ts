import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { getLogger } from '../../log/utils'
import { StateParser } from './parser'
import { BaseStateManager } from './base-manager'
import { InstanceStateV1 } from './state'

export interface StateLoaderArgs {

    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir?: string
}

export class StateLoader extends BaseStateManager {

    private logger = getLogger(StateLoader.name)

    constructor(args?: StateLoaderArgs) {
        super(args)
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
        const instanceStateV1Path = this.getInstanceStatePath(instanceName)

        this.logger.debug(`Checking instance ${instanceName} in directory ${instanceStateV1Path} at ${instanceDir}`)

        return fs.existsSync(instanceDir) && fs.existsSync(instanceStateV1Path)
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

        const instanceStatePath = this.getInstanceStatePath(instanceName)
        if(fs.existsSync(instanceStatePath)) {
            
            this.logger.debug(`Loading instance V1 state for ${instanceName} at ${instanceStatePath}`)
            return yaml.load(fs.readFileSync(instanceStatePath, 'utf8'))

        } else {
            throw new Error(`Instance '${instanceName}' state not found at '${instanceStatePath}'`)
        }
    }

    async loadInstanceStateSafe(instanceName: string): Promise<InstanceStateV1> {
        // state is unchecked, any is acceptable at this point
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawState = await this.loadRawInstanceState(instanceName) as any

        if(rawState.version != "1") {
            throw new Error(`Unknown state version '${rawState.version}'`)
        }

        const parser = new StateParser()
        return parser.parseBaseStateV1(rawState)
    }
}