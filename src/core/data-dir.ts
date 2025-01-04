import * as path from 'path'

export class DataRootDirManager {

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
}