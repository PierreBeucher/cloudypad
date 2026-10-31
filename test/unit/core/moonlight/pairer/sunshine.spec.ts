import * as assert from 'assert';
import sinon from 'sinon';
import { SSHExecCommandResponse } from 'node-ssh';
import { SunshineMoonlightPairer, SunshineMoonlightPairerArgs } from '../../../../../src/core/moonlight/pairer/sunshine';
import { SSHClient } from '../../../../../src/tools/ssh';

function sshResponse(stdout: string): SSHExecCommandResponse {
    return { stdout, stderr: '', code: 0, signal: '' }
}

describe('SunshineMoonlightPairer', () => {

    const pairerArgs: SunshineMoonlightPairerArgs = {
        instanceName: 'test-instance',
        host: '1.2.3.4',
        ssh: { clientName: 'test-ssh', host: '1.2.3.4', user: 'root', privateKeyPath: '/tmp/key' },
        sunshine: { username: 'sunshine', password: 'sunshine' },
    }

    let pairer: SunshineMoonlightPairer
    let sshCommandStub: sinon.SinonStub
    let sshConnectStub: sinon.SinonStub
    let sshDisposeStub: sinon.SinonStub

    function stubSsh(handler: (cmd: string[]) => SSHExecCommandResponse) {
        sshCommandStub = sinon.stub(SSHClient.prototype, 'command').callsFake(async (cmd: string[]) => handler(cmd))
    }

    function pairingsResponse(pairings: { id: string, name?: string, address?: string }[]): SSHExecCommandResponse {
        return sshResponse(JSON.stringify({ pairings }))
    }

    function pinResult(status: string | boolean): SSHExecCommandResponse {
        return sshResponse(JSON.stringify({ status }))
    }

    /**
     * Stub the commands issued by doPair: state reset (docker exec), purge
     * (GET listing + DELETE cancellations) and PIN confirmation (GET listing
     * + POST). Returns the first GET listing as `purgeListings` (stale
     * sessions to cancel), subsequent GET listings as `pinListings`.
     */
    function stubDoPair(purgeListings: { id: string }[], pinListings: { id: string }[]) {
        let getCalls = 0
        stubSsh(cmd => {
            if (cmd[0] === 'docker') return sshResponse('1') // reset + pgrep check
            if (cmd.includes('DELETE')) return sshResponse(JSON.stringify({ status: true }))
            if (cmd.includes('POST')) return pinResult('true')
            getCalls++
            return getCalls === 1 ? pairingsResponse(purgeListings) : pairingsResponse(pinListings)
        })
    }

    beforeEach(() => {
        pairer = new SunshineMoonlightPairer(pairerArgs)
        sshConnectStub = sinon.stub(SSHClient.prototype, 'connect').resolves()
        sshDisposeStub = sinon.stub(SSHClient.prototype, 'dispose').returns()
    })

    afterEach(() => {
        sshCommandStub?.restore()
        sshConnectStub.restore()
        sshDisposeStub.restore()
    })

    describe('pairAuto', () => {

        it('should reset Sunshine state, cancel stale pending pairings, then confirm the PIN', async () => {
            stubDoPair(
                [{ id: 'a'.repeat(32) }], // stale pending pairing listed before pairing
                [{ id: 'b'.repeat(32) }], // our Moonlight client's pending pairing
            )

            await pairer.pairAuto()

            // Reset: Sunshine stopped, state files wiped, Sunshine restarted
            const dockerCmds = sshCommandStub.getCalls()
                .map(call => call.args[0] as string[])
                .filter(cmd => cmd[0] === 'docker')
            assert.ok(dockerCmds.some(cmd => cmd.join(' ').includes('supervisorctl stop sunshine')), 'Sunshine must be stopped')
            assert.ok(dockerCmds.some(cmd => cmd.join(' ').includes('rm -f')), 'State files must be wiped')
            assert.ok(dockerCmds.some(cmd => cmd.join(' ').includes('supervisorctl start sunshine')), 'Sunshine must be restarted')

            // Purge: the stale pending pairing must be cancelled via DELETE
            const deleteCall = sshCommandStub.getCalls()
                .map(call => call.args[0] as string[])
                .find(cmd => cmd.includes('DELETE'))
            assert.ok(deleteCall, 'a DELETE (cancel stale pending pairing) must be sent')
            const deletePayload = JSON.parse(deleteCall[deleteCall.length - 1])
            assert.strictEqual(deletePayload.pairing_id, 'a'.repeat(32))

            // Confirm: the PIN is POSTed for our Moonlight client's pairing
            const postCall = sshCommandStub.getCalls()
                .map(call => call.args[0] as string[])
                .find(cmd => cmd.includes('POST'))
            assert.ok(postCall, 'a POST (confirm pin) must be sent')
            const postPayload = JSON.parse(postCall[postCall.length - 1])
            assert.strictEqual(postPayload.pairing_id, 'b'.repeat(32))
            assert.match(postPayload.pin, /^\d{4}$/)
        })

    })

    describe('pairSendPin', () => {

        it('should pair successfully when a single pending pairing exists and Sunshine confirms the PIN', async () => {
            stubSsh(cmd => {
                if (cmd.includes('POST')) return pinResult('true')
                return pairingsResponse([{ id: 'a'.repeat(32) }])
            })

            const result = await pairer.pairSendPin('1234', 1, 0)
            assert.strictEqual(result, true)
            assert.ok(sshCommandStub.calledTwice, 'a GET (list pairings) then a POST (confirm pin) must be run')
            const postCall = sshCommandStub.secondCall.args[0] as string[]
            const payload = JSON.parse(postCall[postCall.length - 1])
            assert.strictEqual(payload.pairing_id, 'a'.repeat(32))
            assert.strictEqual(payload.pin, '1234')
            assert.strictEqual(payload.name, 'test-instance')
        })

        it('should fail when no pending pairing session exists (Moonlight not waiting for a PIN)', async () => {
            stubSsh(cmd => {
                if (cmd.includes('POST')) return pinResult('true')
                return pairingsResponse([])
            })

            await assert.rejects(pairer.pairSendPin('1234', 1, 0))
            assert.ok(sshCommandStub.calledOnce, 'no PIN POST must be sent when there is no pending pairing')
        })

        it('should retry when the first attempt fails and succeed on the next attempt', async () => {
            stubSsh(cmd => {
                if (cmd.includes('POST')) return pinResult('true')
                // First listing: empty (Moonlight not ready yet), then a pending pairing appears
                return sshCommandStub.callCount === 1 ? pairingsResponse([]) : pairingsResponse([{ id: 'a'.repeat(32) }])
            })

            const result = await pairer.pairSendPin('1234', 2, 0)
            assert.strictEqual(result, true)
            assert.ok(sshConnectStub.callCount >= 2, 'SSH client must be reconnected on each attempt')
        })

    })

})
