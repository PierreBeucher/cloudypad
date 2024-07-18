import { SSHClient, SSHClientArgs } from '../tools/ssh';
import { input } from '@inquirer/prompts';
import { InstanceState, StateManager } from './state';

export interface InstanceDetails {
    name: string
    provider: string 
    host: string
    ssh: {
        user: string
    }
    providerMachineID: string,

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
    
    getWolfPinUrl(): Promise<string>
    pair(): Promise<void>
}

export abstract class AbstractInstanceRunner implements InstanceRunner {
    
    readonly stateManager: StateManager
    
    constructor(stateManager: StateManager) {
        this.stateManager = stateManager
    }
 
    getStateManager(){
        return this.stateManager    
    }

    abstract start(): Promise<void>
    abstract stop(): Promise<void>
    abstract restart(): Promise<void>
    async get(): Promise<InstanceState> {
        return this.stateManager.get()
    }

    async getWolfPinUrl(): Promise<string> {
        const state = await this.stateManager.get()

        if(!state.ssh?.user || !state.ssh?.privateKeyPath) {
            throw new Error("Can't configure instance via SSH: user or private key unknwon. Check instance state.")
        }

        if(!state.host) {
            throw new Error("Can't configure instance: unknown public hostname or IP address.")
        }

        const sshArgs: SSHClientArgs = {
            clientName: state.name,
            host: state.host,
            user: state.ssh.user,
            privateKeyPath: state.ssh.privateKeyPath,
        };
    
        const sshClient = new SSHClient(sshArgs);
    
        try {
            await sshClient.connect();
            const sshCommand = [
                'sh',
                '-c',
                'docker logs wolf-wolf-1 2>&1 | grep -a "Insert pin at" | tail -n 1'
            ];
    
            const result = await sshClient.command(sshCommand);
            const pinSshResults = result.stdout;
    
            // Replace private hostname by public hostname
            const urlRegex = /(http:\/\/[0-9]{1,3}(\.[0-9]{1,3}){3}:[0-9]+\/pin\/#?[0-9A-F]+)/;
            const match = pinSshResults.match(urlRegex);
    
            if (match && match[0]) {
                const url = match[0];
                const replacedUrl = url.replace(/[0-9]{1,3}(\.[0-9]{1,3}){3}/, state.host);
                return replacedUrl;
            } else {
                throw new Error("PIN validation URL not found in Wolf logs.");
            }
        } finally {
            sshClient.dispose();
        }
    }

    async pair(){
        const state = await this.stateManager.get()
        
        if(!state.host) {
            throw new Error("Can't pair instance: unknown host.")
        }

        console.info(`Run Moonlight and add computer:`);
        console.info("")
        console.info(`  ${state.host}`)
        console.info("")
        console.info('Once PIN is shown, press ENTER to continue to verification page.');
        console.info('(verification URL will be known after pairing is initialized by Moonlight)');
        
        await input({ message: 'Press ENTER to continue...' })

        const pinUrl = await this.getWolfPinUrl();

        console.info("Open URL to validate PIN:")
        console.info("")
        console.info(`  ${pinUrl}`)
    }    
}

