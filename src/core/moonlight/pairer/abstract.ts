import { getLogger } from "../../../log/utils"

/**
 * Moonlight pairing interface. Automates pairing process between Moonlight and streaming server.
 */
export interface MoonlightPairer {
    /**
     * Interaactively pair with the streaming server. Will prompt the user for a pin and send it to the streaming server.
     */
    pairInteractive(): Promise<void>
    
    /**
     * Send a pin to the streaming server as part of pairing process.
     * @param pin - The pin to send to the streaming server.
     * @param retries - The number of retries to send the pin.
     * @param retryDelay - The delay between retries in milliseconds.
     */
    pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean>
}

export interface AbstractMoonlightPairerArgs {
    instanceName: string
}

export abstract class AbstractMoonlightPairer implements MoonlightPairer {
    
    protected readonly logger = getLogger(AbstractMoonlightPairer.name)
    protected readonly instanceName: string

    constructor(args: AbstractMoonlightPairerArgs){
        this.instanceName = args.instanceName
    }
    
    abstract pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean>

    async pairInteractive(){
        
        this.logger.debug(`Pairing instance ${this.instanceName} with Sunshine`)

        try {

            await this.doPair()

            console.info(`Instance ${this.instanceName} paired successfully 🤝 👍`)
            console.info(`You can now run Moonlight to connect and play with your instance 🎮`)
        } catch (error) {
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