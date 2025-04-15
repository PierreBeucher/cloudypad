import path from "path";
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { StateSideEffect } from "./abstract";
import { InstanceStateV1 } from "../state";

export interface LocalStateSideEffectArgs {
    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir: string
}

/**
 * Manages instance states on local disk.
 * 
 * State are stored in Cloudy Pad data root directory (also called Cloudy Pad home):
 * ${dataRootDir}/instances/<instance_name>/state.yaml
 */
export class LocalStateSideEffect extends StateSideEffect {

    private readonly args: LocalStateSideEffectArgs 

    constructor(args: LocalStateSideEffectArgs) {
        super()
        this.args = args
    }

    protected getDataRootDir(){
        return this.args.dataRootDir
    }

    protected getInstanceParentDir(){
        return path.join(this.args.dataRootDir, 'instances')
    }

    protected getInstanceDir(instanceName: string): string {
        return path.join(this.getInstanceParentDir(), instanceName)
    }

    protected getInstanceStatePath(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "state.yml")
    }

    /**
     * Persist state on disk
     * 
     * @param state state to persist
     */
    protected async doPersistState(state: InstanceStateV1){
        const statePath = this.getInstanceStatePath(state.name)

        this.logger.debug(`Persisting state for ${state.name} at ${statePath}`)

        await this.ensureInstanceDirExists(state.name)
        fs.writeFileSync(statePath, yaml.dump(state), 'utf-8')
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

    private async removeInstanceDir(instanceName: string): Promise<void> {
        const confDir = this.getInstanceDir(instanceName)

        this.logger.debug(`Removing instance config directory ${instanceName}: '${confDir}'`)

        fs.rmSync(confDir, { recursive: true, force: true })
    }

    listInstances(): string[] {
        try {
            this.ensureInstanceParentDirExists()

            const allInstancesDirPath = path.join(this.getDataRootDir(), 'instances')
            this.logger.debug(`Listing all instances from ${allInstancesDirPath}`)

            const instanceNames = fs.readdirSync(allInstancesDirPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter(instanceName => this.instanceExists(instanceName))

            return instanceNames
        } catch (error) {
            throw new Error('Failed to read instances parent directory.', { cause: error })
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
    async loadRawInstanceState(instanceName: string): Promise<unknown> {
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

    private ensureInstanceParentDirExists() {
        const instanceParentDir = this.getInstanceParentDir()

        if (!fs.existsSync(instanceParentDir)) {
            this.logger.debug(`Creating instance parent directory '${instanceParentDir}'`)

            fs.mkdirSync(instanceParentDir, { recursive: true })

            this.logger.debug(`Created instance parent directory '${instanceParentDir}'`)
        }
    }

    /**
     * Remove instance directory from disk, effectively removing any state data.
     */
    async destroyState(instanceName: string): Promise<void> {
        await this.removeInstanceDir(instanceName)
    }

}