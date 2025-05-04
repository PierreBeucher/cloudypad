import { CoreSdkConfig } from "../config/interface"
import path from "path"

export class DefaultConfigValues {    
    
    /**
     * Return default local Cloudy Pad data root dir (aka Cloudy Pad Home), by order of priority:
     * - $CLOUDYPAD_HOME environment variable
     * - $HOME/.cloudypad
     * - Fails is neither CLOUDYPAD_HOME nor HOME is set
     */
    static defaultLocalDataRootDir(): string {
        if (process.env.CLOUDYPAD_HOME) {
            return process.env.CLOUDYPAD_HOME
        } else {
            if (!process.env.HOME){
                throw new Error("Neither CLOUDYPAD_HOME nor HOME environment variable is set. Could not define Cloudy Pad data root directory.")
            }

            return path.resolve(`${process.env.HOME}/.cloudypad`)
        }
    }

    static buildDefaultConfig(): CoreSdkConfig {
        return {
            stateBackend: DefaultConfigValues.buildDefaultStateBackendConfig(),
            pulumi: DefaultConfigValues.buildDefaultPulumiConfig()
        }
    }

    /**
     * Build default state backend config using local file under Cloudy Pad data home directory.
     */
    static buildDefaultStateBackendConfig(): CoreSdkConfig["stateBackend"] {
        return {
            local: {
                dataRootDir: DefaultConfigValues.defaultLocalDataRootDir()
            }
        }
    }

    /**
     * Build default Pulumi config using local backend under Cloudy Pad data home directory.
     */
    static buildDefaultPulumiConfig(): CoreSdkConfig["pulumi"] {

        return {
            workspaceOptions: {
                envVars: {
                    PULUMI_BACKEND_URL: `file://${path.join(DefaultConfigValues.defaultLocalDataRootDir(), "pulumi-backend")}`,
                    PULUMI_CONFIG_PASSPHRASE: ""
                }
            }
        }
    }
    
}

