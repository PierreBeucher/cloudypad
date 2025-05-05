import { CoreConfig } from "../config/interface"
import path from "path"
import { getLogger } from "../../log/utils"

/**
 * Load Core config from environments (local file, environment variables, etc.)
 * Only default and environment variables are supported for now.
 */
export class ConfigLoader {

    private logger = getLogger(ConfigLoader.name)
    
    /**
     * Return default local Cloudy Pad data root dir (aka Cloudy Pad Home), by order of priority:
     * - $CLOUDYPAD_HOME environment variable
     * - $HOME/.cloudypad
     * - Fails is neither CLOUDYPAD_HOME nor HOME is set
     */
    loadLocalDataRootDir(): string {
        if (process.env.CLOUDYPAD_HOME) {
            return process.env.CLOUDYPAD_HOME
        } else {
            if (!process.env.HOME){
                throw new Error("Neither CLOUDYPAD_HOME nor HOME environment variable is set. Could not define Cloudy Pad data root directory.")
            }

            return path.resolve(`${process.env.HOME}/.cloudypad`)
        }
    }

    loadConfig(): CoreConfig {

        const config = {
            stateBackend: this.loadStateBackendConfig(),
            pulumi: this.loadPulumiConfig()
        }

        this.logger.debug("Loaded Cloudypad Core config: " + JSON.stringify(config))
        
        return config
    }

    loadStateBackendConfig(): CoreConfig["stateBackend"] {

        if(process.env.CLOUDYPAD_STATE_BACKEND_S3_BUCKET_NAME) {
            return {
                s3: {
                    bucketName: process.env.CLOUDYPAD_STATE_BACKEND_S3_BUCKET_NAME,
                }
            }
        } else {
            return {
                local: {
                    dataRootDir: this.loadLocalDataRootDir()
                }
            }
        }
    }

    loadPulumiConfig(): CoreConfig["pulumi"] {

        return {
            workspaceOptions: {
                envVars: {
                    PULUMI_BACKEND_URL: process.env.PULUMI_BACKEND_URL ?? `file://${path.join(this.loadLocalDataRootDir(), "pulumi-backend")}`,
                    PULUMI_CONFIG_PASSPHRASE: process.env.PULUMI_CONFIG_PASSPHRASE ?? ""
                }
            }
        }
    }
    
}

