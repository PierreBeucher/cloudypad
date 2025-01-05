import { PostHog } from 'posthog-node'
import { getLogger } from '../../log/utils'
import { CLOUDYPAD_VERSION } from '../../core/const'

export interface AnalyticsClient {
    init(): void
    shutdown(): Promise<void>
    sendEvent(event: string): void
}

const POSTHOG_API_KEY = process.env.CLOUDYPAD_ANALYTICS_POSTHOG_API_KEY ?? 'phc_caJIOD8vW5727svQf90FNgdALIyYYouwEDEVh3BI1IH'
const POSTHOG_HOST = process.env.CLOUDYPAD_ANALYTICS_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

export abstract class AbstractAnalyticsClient implements AnalyticsClient {

    protected logger = getLogger("AnalyticsClient")

    init()  {
        this.doInit()
    }

    async shutdown() {
        await this.doShutdown()
    }

    sendEvent(event: string, properties?: Record<string | number, unknown> | undefined) {
        this.logger.debug(`Sending analytics event: ${event} with properties ${JSON.stringify(properties)}`)
        this.doSendEvent(event, properties)
    }

    protected abstract doInit(): void

    protected abstract doShutdown(): Promise<void>

    protected abstract doSendEvent(event: string, properties?: Record<string | number, unknown> | undefined): void
}

export interface PostHogAnalyticsManagerArgs {
    distinctId: string
}

export class PostHogAnalyticsClient extends AbstractAnalyticsClient {

    private postHog: PostHog
    private args: PostHogAnalyticsManagerArgs

    constructor(args: PostHogAnalyticsManagerArgs){
        super()
        this.logger.debug(`Creating PostHog client for host ${POSTHOG_HOST}`)
        this.postHog = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST })
        this.postHog.identify({
            distinctId: args.distinctId,
            properties: {
                cloudypad_version: CLOUDYPAD_VERSION,
                initial_cloudypad_version: CLOUDYPAD_VERSION
            }
        })
        this.args = args
    }
    
    protected doSendEvent(event: string, properties?: Record<string | number, unknown> | undefined) {
        this.postHog.capture({
            distinctId: this.args.distinctId,
            event: event,
            properties: properties
        })
    }

    protected doInit() {
        // no op
    }
    
    protected async doShutdown() {
        this.logger.debug(`Shutting down PostHog analytics client...`)

        await this.postHog.shutdown() // Wait at most 5s before final shutdown

        this.logger.debug(`Shut down complete for PostHog analytics client`)
    }
}

/**
 * A no-op AnalyticsManager. It does not send any analytics data. 
 */
export class NoOpAnalyticsClient implements AnalyticsClient {

    init() {
        // no op
    }

    async shutdown() {
        // no op
    }

    sendEvent() {
        // no op
    }
}