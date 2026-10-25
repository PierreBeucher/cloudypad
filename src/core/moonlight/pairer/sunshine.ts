import { AbstractMoonlightPairer, makePin, MoonlightPairer } from "./abstract";
import { SSHClient, SSHClientArgs } from "../../../tools/ssh";
import { SSHExecCommandResponse } from "node-ssh";

export interface SunshineMoonlightPairerArgs {
    instanceName: string
    host: string
    ssh: SSHClientArgs,
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
            instanceName: args.instanceName,
            host: args.host
        })
        this.args = args
    }

    private buildSshClient(): SSHClient {
        this.logger.debug(`Building SSH client with args: ${JSON.stringify(this.args.ssh)}`)
        return new SSHClient(this.args.ssh);
    }

    /**
     * List pending pairing sessions currently waiting for a PIN confirmation.
     * Sunshine 2026+ pairing API: a pending pairing session is created by each
     * Moonlight client waiting for its PIN to be confirmed.
     */
    private async fetchPendingPairings(ssh: SSHClient): Promise<{ id: string, name?: string, address?: string }[]> {
        const result = await ssh.command([
            'curl',
            '-sk',
            '-u',
            `${this.args.sunshine.username}:${this.args.sunshine.password}`,
            'https://localhost:47990/api/pin',
        ])

        this.logger.trace(`Sunshine pending pairings GET via SSH result: ${JSON.stringify(result)}`)

        // Response should contain JSON such as { "pairings": [ { "id": "...", "name": "...", "address": "..." } ] }
        const json = JSON.parse(result.stdout)
        return json.pairings ?? []
    }

    protected async doPair(pin: string) {
        // try to pair for ~2 min by pushing through Sunshine API with our pin
        // Using plain curl + SSH command as Sunshine Web UI is not reachable directly
        // A simple but effective enough method
        // Maybe wen use a more resilient with proper HTTP client and SSH tunneling such as https://github.com/agebrock/tunnel-ssh
        await this.pairSendPin(pin) // defaults: ~2 min budget, 1s polls
    }

    // Retry for ~2 min by default: Moonlight needs time to run its pairing
    // handshake (discovery, cert exchange) before its pending pairing session
    // appears on Sunshine and can be confirmed
    // Retry for ~2 min by default: Moonlight needs time to run its pairing
    // handshake (discovery, cert exchange) before its pending pairing session
    // appears on Sunshine. Polling is fast (1s) as Moonlight only waits a few
    // seconds for the PIN confirmation before giving up on the pairing.
    async pairSendPin(pin: string, retries=120, retryDelayMs=1000): Promise<boolean> {
        let sshClient = this.buildSshClient()
        let pinResult = false
        let lastError: unknown | undefined = undefined
        try {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    await sshClient.connect()
                    pinResult = await this.tryPin(sshClient, pin)
                    if (pinResult) break;
                } catch (error) {
                    lastError = error
                    this.logger.warn(`Attempt ${attempt + 1} failed to send pin to Sunshine API. Retrying...`, error)
                    // Rebuild the client: the SSH connection may be in a broken state
                    sshClient.dispose()
                    sshClient = this.buildSshClient()
                }

                await new Promise(resolve => setTimeout(resolve, retryDelayMs))

            }
        } finally {
            sshClient.dispose()
        }

        if (!pinResult) {
            throw new Error(`Failed to send pin to Sunshine API after ${retries} attempts. Last error:`, { cause: lastError })
        }

        return pinResult
    }

    private async tryPin(ssh: SSHClient, pin: string): Promise<boolean>{

        this.logger.debug(`Trying to send pin to Sunshine API... (enable trace logs to see raw outputs)`)

        // Sunshine 2026+ requires a pairing_id identifying the pending pairing
        // session created by the Moonlight client waiting for its PIN: list
        // pending pairings first, then confirm the one we're pairing with.
        // Fresh listing on each attempt ensures we never confirm a stale session.
        let pendingPairings: { id: string, name?: string, address?: string }[]
        try {
            pendingPairings = await this.fetchPendingPairings(ssh)
        } catch (error) {
            this.logger.warn(`Failed to list pending pairing sessions from Sunshine API.`, { cause: error })
            return false
        }

        this.logger.debug(`Sunshine pending pairings: ${JSON.stringify(pendingPairings)}`)

        if (pendingPairings.length === 0) {
            this.logger.debug(`No pending pairing session on Sunshine: Moonlight is not waiting for a PIN yet.`)
            return false
        }

        if (pendingPairings.length > 1) {
            // Confirming a PIN applies to a single pending client: with multiple
            // pending sessions we cannot safely guess which one is ours. Let
            // stale sessions expire and retry on next attempt.
            this.logger.warn(`Multiple pending pairing sessions on Sunshine (${pendingPairings.map(p => p.id).join(", ")}): skipping PIN attempt to avoid pairing the wrong client.`)
            return false
        }

        let result: SSHExecCommandResponse
        try {
            result = await ssh.command([
                'curl',
                '-sk',
                '-u',
                `${this.args.sunshine.username}:${this.args.sunshine.password}`,
                '-X',
                'POST',
                'https://localhost:47990/api/pin',
                '-H', 'Content-Type: application/json',
                '-d',
                JSON.stringify({ pairing_id: pendingPairings[0].id, pin: pin, name: this.args.instanceName })
            ])
        } catch (error) {
            this.logger.warn(`Failed to send pin to Sunshine API.`, { cause: error })
            return false
        }

        this.logger.trace(`Sunshine pair POST via SSH result: ${JSON.stringify(result)}`)

        // stdout should contain JSON such as { "status": "true" }
        // Try to parse it
        let json;
        try {
            json = JSON.parse(result.stdout);

            this.logger.debug(`Sunshine /api/pin POST JSON output: ${JSON.stringify(json)}`)

            // Sunshine server may respond with true (boolean) or "true" (string)
            return json.status == "true" || json.status == true
        } catch (error) {
            this.logger.warn(`Failed to parse Sunshine API JSON response from raw output ${JSON.stringify(result.stdout)}. If you think this is a bug please report it.`, error);
            return false
        }
    }
}