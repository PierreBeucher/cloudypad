import { AnalyticsClient } from "../../../tools/analytics/client"
import * as fs from 'fs'
import { getLogger } from '../../../log/utils';
import { AnalyticsManager } from "../../../tools/analytics/manager";
import { AbstractMoonlightPairer, MoonlightPairer } from "./abstract";
import { SSHClient } from "../../../tools/ssh";
import { confirm } from '@inquirer/prompts';

export interface SunshineMoonlightPairerArgs {
    instanceName: string
    host: string
    ssh: {
        user: string
        privateKeyPath: string
    },
    sunshine: {
        username: string
        password: string
    }
}

/**
 * Pair with Sunshine using Sunshine API via SSH
 */
export class SunshineMoonlightPairer extends AbstractMoonlightPairer implements MoonlightPairer {
    
    private readonly args: SunshineMoonlightPairerArgs

    constructor(args: SunshineMoonlightPairerArgs) {
        super({
            instanceName: args.instanceName
        })
        this.args = args
    }

    protected async doPair() {

        const pin = this.makePin()

        console.info(`Run this command in another terminal to pair your instance:`)
        console.info()
        console.info(`  moonlight pair ${this.args.host} --pin ${pin}`)
        console.info()
        console.info('Sending PIN to Sunshine API...')
        
        const ssh = new SSHClient({
            clientName: SunshineMoonlightPairer.name,
            host: this.args.host,
            port: 22,
            user: this.args.ssh.user,
            privateKeyPath: this.args.ssh.privateKeyPath
        })

        try {
            await ssh.connect()

            // try to pair for 2 min by punshing through Sunshine API with our pin
            // Using plain curl + SSH command as Sunshine Web UI is not reachable directly
            // A simple but effective enough method
            // Maybe wen use a more resilient with proper HTTP client and SSH tunneling such as https://github.com/agebrock/tunnel-ssh
            const maxRetries = 120;
            let result: boolean;
            let attempts = 0;
    
            do {
                result = await this.tryPin(ssh, pin);
                attempts++;
    
                await new Promise(resolve => setTimeout(resolve, 1000))
            } while (!result && attempts < maxRetries);
    
            if (!result) {
                throw new Error(`Failed to pair after ${maxRetries} attempts. You can try to pair manually.`)
            }   
        } finally {
            ssh.dispose()
        }
        
    }

    private async tryPin( ssh: SSHClient, pin: string): Promise<boolean>{

        this.logger.debug(`Trying to send pin to Sunshine API... (enable trace logs to see raw outputs)`)

        const result = await ssh.command([
            'curl',
            '-u',
            `${this.args.sunshine.username}:${this.args.sunshine.password}`,
            '-X',
            'POST',
            '-k',
            'https://localhost:47990/api/pin',
            '-d',
            JSON.stringify({ pin: pin, name: this.args.instanceName })
        ])

        this.logger.trace(`Sunshine pair POST via SSH result: ${JSON.stringify(result)}`)

        // stdout should contain JSON such as { "status": "true" }
        // Try to parse it
        let json;
        try {
            json = JSON.parse(result.stdout);
            
            this.logger.debug(`Sunshine /api/pin POST JSON output: ${JSON.stringify(json)}`)

            return json.status == "true"    
        } catch (error) {
            this.logger.warn(`Failed to parse Sunshine API JSON response from raw output ${JSON.stringify(result.stdout)}. If you think this is a bug please report it.`, error);
            return false
        }

    }
}