import * as fs from 'fs'
import { input, select } from '@inquirer/prompts';
import Docker from 'dockerode';
import axios from 'axios';
import { URL } from 'url'
import { buildAxiosError } from '../../../tools/axios';
import { AbstractMoonlightPairer, makePin, MoonlightPairer } from "./abstract";

export interface WolfMoonlightPairerArgs {
    instanceName: string
    host: string
    ssh: {
        user: string
        privateKeyPath: string
    }
}

export class WolfMoonlightPairer extends AbstractMoonlightPairer implements MoonlightPairer {
    
    private readonly args: WolfMoonlightPairerArgs

    constructor(args: WolfMoonlightPairerArgs) {
        super({
            instanceName: args.instanceName
        })
        this.args = args
    }

    pairSendPin(pin: string): Promise<boolean> {
        throw new Error("Not implemented")
    }

    protected async doPair(){
        
        try {

            const pairManual = "manual"
            const pairAuto = "auto"

            const privateKey = fs.readFileSync(this.args.ssh.privateKeyPath, 'utf-8')

            const docker = new Docker({
                host: this.args.host,
                protocol: 'ssh',
                port: 22,
                username: this.args.ssh.user,
                sshOptions: {
                    privateKey: privateKey
                }
            })

            const pairMethod = await select({
                message: 'Pair Moonlight automatically or run Moonlight yourself to pair manually ?',
                default: pairAuto,
                choices: [{
                    name: "manual: run Moonlight yourself and add your instance.",
                    value: pairManual
                }, {
                    name: "automatic: run a single command to pair your instance.",
                    value: pairAuto
                }],
                loop: false,
            })

            if(pairMethod === pairManual) {
                await this.pairManual(docker, this.args.host)
            } else if (pairMethod === pairAuto){
                await this.pairAuto(docker, this.args.host)
            } else {
                throw new Error(`Unrecognized pair method '${pairMethod}'. This is probably an internal bug.`)
            }

        } catch (error) {
            const eventProps = error instanceof Error ? { errorMessage: error.message, stackTrace: error.stack } : { errorMessage: String(error), stackTrace: "unknown" }
            throw new Error(`Instance pairing failed.`, { cause: error })
        }
    }
 
    private async waitForPinURL(docker: Docker, host: string) {
        const containerName = 'wolf';
        const pinUrlLogMatch = 'Insert pin at';
        const timeout = 600000; // 10min
        const pollInterval = 1000; // 1s
    
        // Fetch Wolf container logs since this function run until we find a PIN URL log line or timeout
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {

                const container = docker.getContainer(containerName)

                const newLogs = (await container.logs({
                    stdout: true,
                    stderr: true,
                    // Actually use seconds and note UNX timestamp as documented by Docker API
                    since: (startTime / 1000), 
                }))
                .toString('utf-8')
                .trim()
                .split('\n')

                this.logger.trace(`Checking logs for PIN: ${JSON.stringify(newLogs)}`)
        
                const maybePinLogsIndex = newLogs.find(l => l.includes(pinUrlLogMatch))

                if (maybePinLogsIndex) {
                    this.logger.debug(`Found PIN URL: ${maybePinLogsIndex}`)
                    const urlRegex = /(http:\/\/[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+\/pin\/#?[0-9A-F]+)/;
                    const match = maybePinLogsIndex.match(urlRegex);
        
                    if (match && match[0]) {
                        const url = match[0];
                        const replacedUrl = url.replace(/[0-9]{1,3}(\.[0-9]{1,3}){3}/, host);
                        return replacedUrl;
                    } else {
                        this.logger.warn(`Found a line that looked like it contained a PIN URL but didn't: ${maybePinLogsIndex}. Please report a bug with this log.`)
                    }
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval))
            } catch (error) {
                this.logger.warn(`Failed to fetch Wolf logs. Will retry in ${pollInterval}ms.`, { cause: error })
                await new Promise(resolve => setTimeout(resolve, pollInterval))
            }
        }

        throw new Error(`PIN validation URL not found in Wolf logs after ${Date.now() - startTime}ms`);
    }
    
    private async sendPinData(publicPinUrl: string, pin: string, retries=3, retryDelay=2000): Promise<void> {

        try {
            this.logger.info(`Sending PIN to ${publicPinUrl}`)

            this.logger.debug(`Sending PIN ${pin} to ${publicPinUrl}`)

            const secretUrlRegex = /#([0-9A-F]+)/;
            const matchSecret = publicPinUrl.match(secretUrlRegex)
        
            if (!matchSecret || !matchSecret[1]) {
                throw new Error("Secret not found in PIN URL.")
            }
        
            const secret = matchSecret[1];
            const postData = {
                pin: pin,
                secret: secret
            }

            const parsedUrl = new URL(publicPinUrl)
            const postPinUrl = `http://${parsedUrl.hostname}:${parsedUrl.port}/pin/`

            this.logger.debug(`Posting ${JSON.stringify(postData)} to ${postPinUrl}`)
            
            try {
                await axios.post(postPinUrl, postData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            } catch (e){
                throw buildAxiosError(e)
            }
        } catch (e) {
            if(retries > 0){
                this.logger.warn(`Failed to send pin to Wolf API. Retrying...`, { cause: e })
                await new Promise(resolve => setTimeout(resolve, retryDelay))
                return this.sendPinData(publicPinUrl, pin, retries - 1, retryDelay)
            }

            this.logger.error(`Failed to send pin to Wolf API. Giving up.`, { cause: e })
            throw e
        }
    }

    private async pairManual(docker: Docker, host: string) {
        
        console.info(`Run Moonlight and add instance manually (top right '+' button):`)
        console.info()
        console.info(`  ${host}`)
        console.info()
        console.info("Then click on the new machine (with a lock icon). It will generate a PIN we'll use to pair your instance.")
        console.info()
        console.info('Waiting for PIN URL to appear in Wolf logs...')
        
        const publicPinUrl = await this.waitForPinURL(docker, host)

        const pin = await input({
            message: 'Enter PIN shown by Moonlight to finalize pairing:',
        })

        console.info("Sending PIN to Wolf...")
 
        await this.sendPinData(publicPinUrl, pin)
    }

    private async pairAuto(docker: Docker, host: string) {

        const pin = makePin()

        console.info(`Run this command to pair your instance:`)
        console.info()
        console.info(`  moonlight pair ${host} --pin ${pin}`)
        console.info()
        console.info(`For Mac / Apple devices, you may need to use this pseudo-IPv6 address:`)
        console.info()
        console.info(`  moonlight pair ::ffff:${host} --pin ${pin}`)
        console.info()
        console.info('Waiting for PIN URL to appear in Wolf logs...')

        const publicPinUrl = await this.waitForPinURL(docker, host)

        console.info("Sending PIN to Wolf...")
 
        await this.sendPinData(publicPinUrl, pin)
    }
    
}