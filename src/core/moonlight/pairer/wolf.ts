import * as fs from 'fs'
import { input, select } from '@inquirer/prompts';
import Docker from 'dockerode';
import axios from 'axios';
import { URL } from 'url'
import { buildAxiosError, CloudyPadAxiosError } from '../../../tools/axios';
import { AbstractMoonlightPairer, makePin, MoonlightPairer } from "./abstract";
import { SSHClientArgs } from '../../../tools/ssh';

export interface WolfMoonlightPairerArgs {
    instanceName: string
    host: string
    ssh: SSHClientArgs
}

export class WolfMoonlightPairer extends AbstractMoonlightPairer implements MoonlightPairer {
    
    private readonly args: WolfMoonlightPairerArgs

    constructor(args: WolfMoonlightPairerArgs) {
        super({
            instanceName: args.instanceName,
            host: args.host
        })
        this.args = args
    }

    pairSendPin(pin: string): Promise<boolean> {
        throw new Error("Not implemented")
    }

    private buildDockerClient(): Docker {

        const privateKeyContent = this.args.ssh.privateKeyPath ? fs.readFileSync(this.args.ssh.privateKeyPath, 'utf-8') : undefined

        const docker = new Docker({
            host: this.args.host,
            protocol: 'ssh',
            port: 22,
            username: this.args.ssh.user,
            sshOptions: {
                privateKey: privateKeyContent,
                password: this.args.ssh.password
            }
        });

        return docker
    }
 
    private async getLatestPinURL(docker: Docker, host: string): Promise<string | undefined> {
        const containerName = 'wolf';
        const pinUrlLogMatch = 'Insert pin at';
    
        try {
            const container = docker.getContainer(containerName)

            const logs = (await container.logs({
                stdout: true,
                stderr: true,
                tail: 500,
            }))
            .toString('utf-8')
            .trim()
            .split('\n')

            this.logger.trace(`Checking logs for PIN: ${JSON.stringify(logs)}`)

            // Find the latest line that matches the PIN URL pattern
            const pinUrlRegex = /(http:\/\/[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+\/pin\/#?[0-9A-F]+)/;
            
            // Look per line in reverse order (start by last line) to match against most recent lines first
            for (let i = logs.length - 1; i >= 0; i--) {
                const logLine = logs[i];
                if (logLine.includes(pinUrlLogMatch)) {
                    this.logger.debug(`Found PIN URL line: ${logLine}`)
                    const match = logLine.match(pinUrlRegex);
        
                    if (match && match[0]) {
                        const url = match[0];
                        const replacedUrl = url.replace(/[0-9]{1,3}(\.[0-9]{1,3}){3}/, host);
                        return replacedUrl;
                    } else {
                        this.logger.warn(`Found a line that looked like it contained a PIN URL but didn't: ${logLine}. Please report a bug with this log.`)
                    }
                }
            }

            return undefined;
        } catch (error) {
            this.logger.warn(`Failed to fetch Wolf logs.`, { cause: error })
            return undefined;
        }
    }
    
    /**
     * Send the PIN to Wolf API. Getting errors from Wolf API is expected since it will return 200 and "OK" even if pairing failed
     * but may return 400 is PIN URL is tried multiple times. 
     * 
     * Such API errors are shown at debug level and won't trigger a retry nor an exception.
     * Over errors are shown are rethrown.
     * 
     * @param publicPinUrl - PIN URL to send the PIN to.
     * @param pin - PIN to send.
     */
    private async sendPinData(publicPinUrl: string, pin: string): Promise<void> {

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
                const response = await axios.post(postPinUrl, postData, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                })

                this.logger.debug(`Wolf pair request response: ${JSON.stringify(response.data)}`)

            } catch (e){
                throw buildAxiosError(e)
            }
        } catch (e) {
           
            if(e instanceof CloudyPadAxiosError){
                this.logger.debug(`Failed to send pin to Wolf API. This is expected if the PIN URL is already used or using a previous PIN URL.`, { cause: e })
            } else {
                throw new Error(`Unexpected error sending pin to Wolf API.`, { cause: e })
            }
        }
    }

    /**
     * Check if the pairing was successful by looking for a success message in the logs.
     * Only logs appearing after the given date are considered.
     */
    private async checkPairingSuccess(docker: Docker, notBefore: Date): Promise<boolean> {
        const containerName = 'wolf';
        const successLogMatch = 'Succesfully paired';

        try {
            const container = docker.getContainer(containerName)

            const logs = (await container.logs({
                stdout: true,
                stderr: true,
                tail: 100,
                // Only check logs appeared after given date
                // Actually use seconds and note UNX timestamp as documented by Docker API
                since: (notBefore.getTime() / 1000), 
            }))
            .toString('utf-8')
            .trim()
            .split('\n')

            // Check for success or failure messages in recent logs
            for (let i = logs.length - 1; i >= 0; i--) {
                const logLine = logs[i];
                if (logLine.includes(successLogMatch)) {
                    this.logger.debug(`Found pairing success: ${logLine}`)
                    return true;
                }
            }

            // If no success/failure message found, assume still in progress or failed
            return false;
        } catch (error) {
            this.logger.warn(`Failed to check pairing status.`, { cause: error })
            return false;
        }
    }

    /**
     * May be called in both situations:
     * - User has not initiated the pairing process yet and generated a PIN through Moonlight. A PIN URL should be available in Wolf logs.
     * - User has not yet initiated the pairing process. A PIN URL is not available in Wolf logs, or the last one available is outdated.
     * 
     * To accountf for both situation, send the PIN in a loop until success. Since Wolf API always returns 200 and "OK" even
     * if pairing failed, rely on logs to check if pairing was successful.
     */
    protected async doPair(pin: string) {

        this.logger.debug(`Pairing instance ${this.instanceName} with Wolf for host ${this.args.host}`)

        const docker = this.buildDockerClient()
        const timeout = 60 * 5 * 1000; // 5 minutes
        const pollInterval = 2000; // 2s
        const startTime = new Date();

        // voluntary console.info to show in user's console
        console.info("Sending PIN to Wolf...")

        while (Date.now() - startTime.getTime() < timeout) {
            try {

                this.logger.debug(`Fetching latest PIN URL in logs of Wolf container...`)

                const publicPinUrl = await this.getLatestPinURL(docker, this.args.host)
         
                if (!publicPinUrl) {
                    this.logger.debug(`No PIN URL found in logs, waiting for user to initiate pairing...`)
                    await new Promise(resolve => setTimeout(resolve, pollInterval))
                    continue;
                }

                this.logger.debug(`Sending PIN to ${publicPinUrl}...`)

                await this.sendPinData(publicPinUrl, pin)

                this.logger.debug(`Checking in logs if pairing was successful...`)

                const pairingSuccess = await this.checkPairingSuccess(docker, startTime)

                if (pairingSuccess) {
                    this.logger.info(`Successfully paired instance ${this.instanceName} with Wolf`)
                    return;
                }

                this.logger.debug(`Pairing not yet successful, will retry in ${pollInterval}ms...`)
                await new Promise(resolve => setTimeout(resolve, pollInterval))

            } catch (e) {
                this.logger.error(`Failed to pair instance ${this.instanceName} with Wolf.`, { cause: e })
                await new Promise(resolve => setTimeout(resolve, pollInterval))
            }
        }

        throw new Error(`Failed to pair instance ${this.instanceName} with Wolf after ${timeout}ms timeout`);
    }
        
}