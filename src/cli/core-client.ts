import { CloudypadClient } from "../core/client"
import { DefaultConfigValues } from "../core/config/default"
import { getLogger } from "../log/utils"

const logger = getLogger("core-client")

export function getCliCoreClient(): CloudypadClient {
    const defaultConfig = DefaultConfigValues.buildDefaultConfig()
    logger.debug("Building core client with config: " + JSON.stringify(defaultConfig))

    const client = new CloudypadClient({
        config: defaultConfig
    })
    return client
}