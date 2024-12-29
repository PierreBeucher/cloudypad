import * as path from 'path'

export interface BaseStateManagerArgs {

    /**
     * Data root directory where Cloudy Pad state are saved.
     * Default to value returned by getEnvironmentDataRootDir()
     */
    dataRootDir?: string
}

export class BaseStateManager {
    
    /**
     * Return current environments Cloudy Pad data root dir, by order of priority:
     * - $CLOUDYPAD_HOME environment variable
     * - $HOME/.cloudypad
     * - Fails is neither CLOUDYPAD_HOME nor HOME is set
     * 
     * This function is used by all components with side effects in Cloudy Pad data root dir (aka Cloudy Pad Home)
     * and can be mocked during tests to control side effect
     */
    static getEnvironmentDataRootDir(): string {
        if (process.env.CLOUDYPAD_HOME) {
            return process.env.CLOUDYPAD_HOME
        } else {
            if (!process.env.HOME){
                throw new Error("Neither CLOUDYPAD_HOME nor HOME environment variable is set. Could not define Cloudy Pad data root directory.")
            }

            return path.resolve(`${ process.env.HOME}/.cloudypad`)
        }
    }

    protected readonly dataRootDir: string 

    constructor(args?: BaseStateManagerArgs) {
        this.dataRootDir = args?.dataRootDir ?? BaseStateManager.getEnvironmentDataRootDir()
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