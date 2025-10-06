import { getLogger, Logger } from "../log/utils"

export interface RetrierArgs<R> {
    actionFn: () => Promise<R>
    actionName: string
    retries: number
    retryDelaySeconds: number

    /**
     * Logging behavior on error and retry. Defaults to warning.
     */
    onRetryLogBehavior?: "error" | "warning" | "info" | "debug" | "silent"
}

/**
 * Perform actions with retry logic.
 */
export class ActionRetrier<R> {
    private readonly logger: Logger
    private readonly args: RetrierArgs<R>

    constructor(args: RetrierArgs<R>) {
        this.args = args
        this.logger = getLogger(`ActionRetrier-${args.actionName}`)
    }

    /**
     * Perform an action with retry logic.
     * @param actionFn Action to perform
     * @param actionName Name of the action to log
     * @param retryOptions Number of retries and delay between retries.
     */
    async run(): Promise<R> {
        const retries = this.args.retries
        const retryDelaySeconds = this.args.retryDelaySeconds

        // if no retries, plainly perform action once return result
        if (retries === 0) {
            return this.args.actionFn()
        }

        // perform action with retry logic
        // Log error as warning and retry until max retries which throws an error with the last error as cause
        let lastError: unknown
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await this.args.actionFn()
            } catch (error) {
                lastError = error
                
                if (attempt < retries) {
                    const logMessage = `${this.args.actionName} attempt ${attempt + 1}/${retries + 1} failed, retrying in ${retryDelaySeconds} seconds.`
                    switch (this.args.onRetryLogBehavior ?? ActionRetrier.getDefaultRetryLogBehavior()) {
                        case "error":
                            this.logger.error(logMessage, lastError)
                            break
                        case "warning":
                            this.logger.warn(logMessage, lastError)
                            break
                        case "info":
                            this.logger.info(logMessage, lastError)
                            break
                        case "debug":
                            this.logger.debug(logMessage, lastError)
                            break
                        case "silent":
                            // noop
                            break
                    }
                    await new Promise(resolve => setTimeout(resolve, retryDelaySeconds * 1000))
                }
            }
        }

        throw new Error(`${this.args.actionName} failed after ${retries + 1} attempts.`, { cause: lastError })
    }

    /**
     * Default log behavior on error and retry. Set as static function to be mocked in tests.
     * 
     * @returns Default log behavior
     */
    static getDefaultRetryLogBehavior(): "error" | "warning" | "info" | "debug" | "silent" {
        return "warning"
    }
}
