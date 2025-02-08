import { AnalyticsManager } from "../../../tools/analytics/manager"

import { getLogger } from "../../../log/utils"
import { AnalyticsClient } from "../../../tools/analytics/client"

/**
 * Moonlight pairing interface. Automates pairing process between Moonlight and streaming server.
 */
export interface MoonlightPairer {
    pairInteractive(): Promise<void>
    
    pairSendPin(pin: string): Promise<boolean>
}

export interface AbstractMoonlightPairerArgs {
    instanceName: string
}

export abstract class AbstractMoonlightPairer implements MoonlightPairer {
    
    protected readonly logger = getLogger(AbstractMoonlightPairer.name)
    protected readonly analytics: AnalyticsClient = AnalyticsManager.get()
    protected readonly instanceName: string

    constructor(args: AbstractMoonlightPairerArgs){
        this.instanceName = args.instanceName
    }
    
    abstract pairSendPin(pin: string): Promise<boolean>

    async pairInteractive(){
        
        this.logger.debug(`Pairing instance ${this.instanceName} with Sunshine`)

        try {

            await this.doPair()

            console.info(`Instance ${this.instanceName} paired successfully 🤝 👍`)
            console.info(`You can now run Moonlight to connect and play with your instance 🎮`)
        } catch (error) {
            const eventProps = error instanceof Error ? { errorMessage: error.message, stackTrace: error.stack } : { errorMessage: String(error), stackTrace: "unknown" }
            this.analytics.sendEvent("pairing_error", eventProps)
            throw new Error(`Instance pairing failed.`, { cause: error })
        }
    }

    protected abstract doPair(): Promise<void>
}


/**
 * Generate a random 4-digit PIN suitable for Moonlight pairing
 */
export function makePin(): string {
    let result = '';
    const charSet = '0123456789';
    for (let i = 0; i < 4; i++) {
        result += charSet.charAt(Math.floor(Math.random() * charSet.length));
    }
    return result;
}