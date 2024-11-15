import * as path from 'path';

/**
 * Utils function related to Cloudy Pad data directory,
 * by default in user home ~/.cloudypad.
 * 
 * Everything related to manipulating Cloudy Pad data should fetch related directories here.
 * Tests and mocks can override return value to force writing of states in a controlled directory.
 */
export class DataHomeUtils {

    /**
     * Data directory with all Cloudy Pad data. Default to 
     * $HOME/.cloudypad but may be changed with CLOUDYPAD_HOME environment variable. 
     */
    static getDataDirPath(): string {
        if (process.env.CLOUDYPAD_HOME) {
            return process.env.CLOUDYPAD_HOME
        } else {
            if (!process.env.HOME){
                throw new Error("Neither CLOUDYPAD_HOME nor HOME environment is set. Could not define Cloudy Pad data directory path.")
            }

            return path.resolve(`${ process.env.HOME}/.cloudypad`)
        }
    }

    /**
     * Instance directory under data directory where instance states are stored, normally ${CLOUDYPAD_HOME}/instances
     */
    static getInstanceDirPath(): string {
        return path.resolve(`${this.getDataDirPath()}/instances`)
    }
}