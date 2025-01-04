import { ConfigManager } from "../../core/config/manager"
import { getLogger } from "../../log/utils"
import { AnalyticsClient, NoOpAnalyticsClient, PostHogAnalyticsClient } from "./client"

export class AnalyticsManager {
    
    private static client: AnalyticsClient

    private static logger = getLogger(AnalyticsManager.name)

    /**
     * Build an AnalyticsManager using current global configuration.
     * Returned instance is a singleton initialized the firs time this function is called.
     * 
     * On first call, global configuration is read and depending on analytics configuration
     * (enabled or disabled) an AnalyticsClient is created to match config (eg. a no-op client if disabled
     * or a real client if enabled)
     */
    static get(): AnalyticsClient {

        if(AnalyticsManager.client){
            return AnalyticsManager.client
        }

        const config = ConfigManager.getInstance().load()

        if(config.analytics.enabled) {

            AnalyticsManager.logger.debug("Initializing PostHog AnalyticsClient")

            if (!config.analytics.posthog?.distinctId) {
                throw new Error("Analytics enabled but PostHog distinctId not set")
            }
    
            AnalyticsManager.client = new PostHogAnalyticsClient({ distinctId: config.analytics.posthog.distinctId})
        } else {
            AnalyticsManager.logger.debug("Initializing NoOp AnalyticsClient")

            AnalyticsManager.client = new NoOpAnalyticsClient()
        }

        return AnalyticsManager.get()
    }
}