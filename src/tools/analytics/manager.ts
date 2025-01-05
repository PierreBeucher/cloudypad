import { ConfigManager } from "../../core/config/manager"
import { getLogger } from "../../log/utils"
import { AnalyticsClient, NoOpAnalyticsClient, PostHogAnalyticsClient } from "./client"

export class AnalyticsManager {
    
    private static client: AnalyticsClient

    private static logger = getLogger(AnalyticsManager.name)

    /**
     * Build an AnalyticsManager using current global configuration.
     * Returned instance is a singleton initialized the firs time this function is called..
     * 
     * On first call, create an analytics client following:
     * - If CLOUDYPAD_ANALYTICS_DISABLE is true, a dummy no-op client is created
     * - If global enables analytics, a client is created accordingly
     * - Otherwise, a dummy no-op client is created
     */
    static get(): AnalyticsClient {

        if(AnalyticsManager.client){
            return AnalyticsManager.client
        }

        if(process.env.CLOUDYPAD_ANALYTICS_DISABLE === "true" || process.env.CLOUDYPAD_ANALYTICS_DISABLE === "1") {
            AnalyticsManager.logger.debug(`Initializing NoOp AnalyticsClient as per CLOUDYPAD_ANALYTICS_DISABLE=${process.env.CLOUDYPAD_ANALYTICS_DISABLE}`)
        }

        const config = ConfigManager.getInstance().load()

        if(config.analytics.enabled) {

            AnalyticsManager.logger.debug("Initializing PostHog AnalyticsClient")

            if (!config.analytics.posthog?.distinctId) {
                throw new Error("Analytics enabled but PostHog distinctId not set")
            }
    
            AnalyticsManager.client = new PostHogAnalyticsClient({ distinctId: config.analytics.posthog.distinctId})
        } else {
            AnalyticsManager.logger.debug("Initializing NoOp AnalyticsClient as no config enables analytics")

            AnalyticsManager.client = new NoOpAnalyticsClient()
        }

        return AnalyticsManager.get()
    }
}