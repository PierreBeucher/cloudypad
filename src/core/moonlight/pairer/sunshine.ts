import { AbstractMoonlightPairer, makePin, MoonlightPairer } from "./abstract";
import { SSHClient, SSHClientArgs } from "../../../tools/ssh";
import { SSHExecCommandResponse } from "node-ssh";

export interface SunshineMoonlightPairerArgs {
    instanceName: string
    host: string
    ssh: SSHClientArgs,
    sunshine: {
        username: string,
        password: string,
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
            host: args.host,
        })
        this.args = args
    }

    private buildSshClient(): SSHClient {
        this.logger.debug(`Building SSH client with args: ${JSON.stringify(this.args.ssh)}`)
        return new SSHClient(this.args.ssh);
    }

    /**
     * Purge all pending pairing sessions via Sunshine API (DELETE /api/pin):
     * Sunshine 2026+ cancels a pairing request waiting for PIN approval.
     * Called before our pairing flow: any pending pairing session created
     * during our pairing window is therefore ours, never a stale session left
     * by a previous pairing attempt.
     */
    private async purgePendingPairings(ssh: SSHClient): Promise<void> {
        const pendingPairings = await this.fetchPendingPairings(ssh)
        for (const pairing of pendingPairings) {
            this.logger.info(`Cancelling stale pending pairing session ${pairing.id} (name: ${pairing.name}, address: ${pairing.address})`)
            const result = await ssh.command([
                'curl',
                '-sk',
                '-u',
                `${this.args.sunshine.username}:${this.args.sunshine.password}`,
                '-X',
                'DELETE',
                'https://localhost:47990/api/pin',
                '-H', 'Content-Type: application/json',
                '-d',
                JSON.stringify({ pairing_id: pairing.id }),
            ])
            this.logger.trace(`Sunshine pair DELETE via SSH result: ${JSON.stringify(result)}`)
        }
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
        // Start from a clean pairing slate before Moonlight creates its
        // pending pairing session: purge any stale pending pairing session
        // (eg. left by a previous pairing attempt or a concurrent client).
        // The only pending session seen during our pairing window is
        // therefore the one our Moonlight client creates.
        const sshClient = this.buildSshClient()
        try {
            await sshClient.connect()
            await this.purgePendingPairings(sshClient)
        } finally {
            sshClient.dispose()
        }

        await this.pairSendPin(pin) // defaults: ~2 min budget, 1s polls
    }

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

            // Sunshine server may respond with true (boolean) or "true" (string)
            return json.status == "true" || json.status == true
        } catch (error) {
            this.logger.warn(`Failed to parse Sunshine pair POST JSON output: ${result.stdout}`, error)
            return false
        }
    }
}
