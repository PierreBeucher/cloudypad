import { ConfigManager } from "../../cli/config"
import { getLogger } from "../../log/utils"
import { AnalyticsClient, NoOpAnalyticsClient, PostHogAnalyticsClient } from "./client"
import os from "os"
export class AnalyticsManager {
    
    private static client: AnalyticsClient

    private static logger = getLogger(AnalyticsManager.name)

    /**
     * Build an AnalyticsManager using current global configuration.
     * Returned instance is a singleton initialized the firs time this function is called.
     * 
     * On first call, create an analytics client following:
     * - If CLOUDYPAD_ANALYTICS_DISABLE is true, a dummy no-op client is created
     * - If global enables analytics, a client is created according to collection method
     *    - None: do not collect anything
     *    - Technical: only collect technical non-personal data
     *    - All: collect everything, including personal data
     * - Otherwise, a dummy no-op client is created
     */
    static get(): AnalyticsClient {

        if(AnalyticsManager.client){
            return AnalyticsManager.client
        }

        if(process.env.CLOUDYPAD_ANALYTICS_DISABLE === "true" || process.env.CLOUDYPAD_ANALYTICS_DISABLE === "1") {
            AnalyticsManager.logger.debug(`Initializing NoOp AnalyticsClient as per CLOUDYPAD_ANALYTICS_DISABLE=${process.env.CLOUDYPAD_ANALYTICS_DISABLE}`)
            AnalyticsManager.client = new NoOpAnalyticsClient()
        }

        const config = ConfigManager.getInstance().load()

        AnalyticsManager.logger.debug("Initializing PostHog AnalyticsClient")

        if (!config.analytics.posthog?.distinctId) {
            throw new Error("Analytics enabled but PostHog distinctId not set. This is probably an internal bug, please file an issue.")
        }

        switch(config.analytics.posthog.collectionMethod) {
            case "all":
                // Collect additional personal data
                AnalyticsManager.client = new PostHogAnalyticsClient({ 
                    distinctId: config.analytics.posthog.distinctId,
                    additionalProperties: {
                        "os_name": os.platform(),
                        "os_version": os.version(),
                        "os_arch": os.arch(),
                        "os_release": os.release(),
                    },
                })
                break
            case "technical":
                // Simply client with no additional properties
                // Explicitely disable personao data tracking
                AnalyticsManager.client = new PostHogAnalyticsClient({ 
                    distinctId: config.analytics.posthog.distinctId,
                    additionalProperties: { 
                        "$process_person_profile": false 
                    },
                })
                break
            case "none":
                AnalyticsManager.client = new NoOpAnalyticsClient()
                break
        }

        return AnalyticsManager.get()
    }
}