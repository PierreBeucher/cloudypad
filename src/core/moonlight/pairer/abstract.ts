import { getLogger } from "../../../log/utils"
import { input, select } from '@inquirer/prompts';

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
    host: string
}

export abstract class AbstractMoonlightPairer implements MoonlightPairer {
    
    protected readonly logger = getLogger(AbstractMoonlightPairer.name)
    protected readonly instanceName: string
    protected readonly host: string

    constructor(args: AbstractMoonlightPairerArgs){
        this.instanceName = args.instanceName
        this.host = args.host
    }
    
    abstract pairSendPin(pin: string, retries?: number, retryDelay?: number): Promise<boolean>

    /**
     * Pair with the streaming server interactively: prompt for PIN or generate PIN and send pairing request
     * in the background. Both pairing methods are supported:
     * - Automated: a PIN is generated and sent to the streaming server, user can run a `moonlight pair` command with pre-defined PIN
     * - Manual: let user initiate pairing process via Moonlight and enter PIN in prompt
     */
    async pairInteractive(){
        
        this.logger.debug(`Pairing instance ${this.instanceName} with Sunshine`)

        try {

            await this.doPairInteractive()

            console.info(`Instance ${this.instanceName} paired successfully 🤝 👍`)
            console.info(`You can now run Moonlight to connect and play with your instance 🎮`)
        } catch (error) {
            throw new Error(`Instance pairing failed.`, { cause: error })
        }
    }

    private async doPairInteractive(){
        
        try {

            const pairManual = "manual"
            const pairAuto = "auto"

            const pairMethod = await select({
                message: 'Pair Moonlight automatically or run Moonlight yourself to pair manually ?',
                default: pairAuto,
                choices: [{
                    name: "manual: run Moonlight yourself to pair your instance.",
                    value: pairManual
                }, {
                    name: "automatic: run a single command to pair your instance.",
                    value: pairAuto
                }],
                loop: false,
            })

            if(pairMethod === pairManual) {
                await this.initiatePairManual()
            } else if (pairMethod === pairAuto){
                await this.initiatePairAuto()
            } else {
                throw new Error(`Unrecognized pair method '${pairMethod}'. This is probably an internal bug.`)
            }

        } catch (error) {
            throw new Error(`Instance pairing failed.`, { cause: error })
        }
    }

    private async initiatePairManual(){
        console.info(`Run Moonlight and add instance manually (top right '+' button):`)
        console.info()
        console.info(`  ${this.host}`)
        console.info()
        console.info("Then click on the new machine (with a lock icon). It will show a PIN we'll use to pair your instance.")
        console.info()

        const pin = await input({
            message: 'Enter PIN shown by Moonlight to finalize pairing:',
        })

        await this.doPair(pin)

    }

    private async initiatePairAuto(){
        const pin = makePin()

        console.info(`Run this command to pair your instance:`)
        console.info()
        console.info(`  moonlight pair ${this.host} --pin ${pin}`)
        console.info()
        console.info(`For Mac / Apple devices, you may need to use this pseudo-IPv6 address:`)
        console.info()
        console.info(`  moonlight pair ::ffff:${this.host} --pin ${pin}`)
        console.info()
        
        await this.doPair(pin)
    }

    /**
     * Pair with the streaming server by sending the provided PIN
     */
    protected abstract doPair(pin: string): Promise<void>

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