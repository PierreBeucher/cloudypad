import * as fs from 'fs'
import { input } from '@inquirer/prompts';
import { InstanceState, StateManager } from './state';
import Docker from 'dockerode';
import axios from 'axios';
import { URL } from 'url'
import { buildAxiosError } from '../tools/axios';
import { getLogger, Logger } from '../log/utils';

/**
 * Options that may be passed to InstanceRunner functions
 */
export interface InstanceRunnerOptions  {
    autoApprove?: boolean
}

/**
 * Instance Runner manages running time lifecycle of instances: start/stop/restart
 * and utility functions like pairing and fetching Moonlight PIN
 */
export interface InstanceRunner {

    start(): Promise<void>
    stop(): Promise<void>
    restart(): Promise<void>
    get(): Promise<InstanceState>
    
    pair(): Promise<void>
}

export abstract class AbstractInstanceRunner implements InstanceRunner {
    
    readonly stateManager: StateManager
    protected readonly logger: Logger

    constructor(sm: StateManager) {
        this.stateManager = sm
        this.logger = getLogger(sm.name()) 
    }
 
    getStateManager(){
        return this.stateManager
    }

    async start(): Promise<void> {
        this.logger.info(`Starting instance ${this.getStateManager().name()}`)
    }

    async stop(): Promise<void> {
        this.logger.info(`Stopping instance ${this.getStateManager().name()}`)
    }

    async restart(): Promise<void> {
        this.logger.info(`Restarting instance ${this.getStateManager().name()}`)
    }

    async get(): Promise<InstanceState> {
        
        this.logger.debug(`Getting instance ${this.stateManager.get().name}`)
        return this.stateManager.get()
    }

    private async waitForPinURL(docker: Docker, host: string) {
        const containerName = 'wolf';
        const pinUrlLogMatch = 'Insert pin at';
        const timeout = 600000; // 10min
        const pollInterval = 1000; // 1s
        
        const container = docker.getContainer(containerName);

        // Fetch Wolf container logs since this function run until we find a PIN URL log line or timeout
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {

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
        }

        throw new Error(`PIN validation URL not found in Wolf logs after ${Date.now() - startTime}ms`);
    }
    
    private async sendPinData(publicPinUrl: string, pin: string): Promise<void> {

        this.logger.info(`Sending PIN to ${publicPinUrl}`)

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
    }
    
    async pair(){
        const state = this.stateManager.get()
        
        if(!state.host) {
            throw new Error("Can't pair instance: unknown host.")
        }

        if (!state.ssh?.user || !state.ssh?.privateKeyPath) {
            throw new Error("Can't configure instance via SSH: user or private key unknown. Check instance state.")
        }

        if (!state.host) {
            throw new Error("Can't configure instance: unknown public hostname or IP address.")
        }

        console.info(`Run Moonlight and add computer:`)
        console.info()
        console.info(`  ${state.host}`)
        console.info()
        console.info("Then click on the new machine to trigger pairing. It will generate a PIN we'll use to pair your instance.")
        console.info()
        console.info('Waiting for PIN URL to appear in Wolf logs...')

        const privateKey = fs.readFileSync(state.ssh.privateKeyPath, 'utf-8')

        const docker = new Docker({
            host: state.host,
            protocol: 'ssh',
            port: 22,
            username: state.ssh.user,
            sshOptions: {
                privateKey: privateKey
            }
        })

        const publicPinUrl = await this.waitForPinURL(docker, state.host)
        
        this.logger.info(`Found PIN URL in logs: ${publicPinUrl}`)
        
        console.info("PIN URL found in Wolf logs !")
        console.info("")
        
        const pin = await input({
            message: 'Enter PIN shown by Moonlight to finalize pairing:',
        })

        console.info("Sending PIN...")

        await this.sendPinData(publicPinUrl, pin)

        console.info(`Instance ${state.name} paired successfully 🤝 👍`)
    }    
}

