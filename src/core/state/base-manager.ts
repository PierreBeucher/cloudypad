import * as path from 'path'
import { DataRootDirManager } from '../data-dir'

export interface BaseStateManagerArgs {

    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir?: string
}

export class BaseStateManager {

    protected readonly dataRootDir: string 

    constructor(args?: BaseStateManagerArgs) {
        this.dataRootDir = args?.dataRootDir ?? DataRootDirManager.getEnvironmentDataRootDir()
    }
    
    protected getDataRootDir(){
        return this.dataRootDir
    }

    protected getInstanceDir(instanceName: string): string {
        return path.join(this.dataRootDir, 'instances', instanceName)
    }

    protected getInstanceStatePath(instanceName: string): string {
        return path.join(this.getInstanceDir(instanceName), "state.yml")
    }
}