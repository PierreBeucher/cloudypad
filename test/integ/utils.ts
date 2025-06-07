import { CloudypadClient } from "../../src/core/client";
import fs from "fs"
import path from "path"
import { CoreConfig } from "../../src/core/config/interface";

export function getIntegTestCoreConfig(): CoreConfig {
    // ensure directory relative to this file ./tmp exists
    const integTestDataRootDir = path.join(__dirname, "./.data-root-dir")
    const pulumiBackendDir = path.join(integTestDataRootDir, "pulumi")
    fs.mkdirSync(integTestDataRootDir, { recursive: true })
    fs.mkdirSync(pulumiBackendDir, { recursive: true })
    
    const config: CoreConfig = {
        stateBackend: {
            local: {
                dataRootDir: integTestDataRootDir
            }
        },
        pulumi: {
            workspaceOptions: {
                envVars: {
                    PULUMI_BACKEND_URL: `file:///${pulumiBackendDir}`
                }
            }
        }
    }
    return config
}
/**
 * Create a Core client suitable for testing. The instance returned use the
 * a local data backend with a temporary directory which remains the same for all tests
 */
export function getIntegTestCoreClient(): CloudypadClient{
    return new CloudypadClient({
        config: getIntegTestCoreConfig()
    })
}
