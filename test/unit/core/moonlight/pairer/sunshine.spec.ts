import * as assert from 'assert';
import sinon from 'sinon';
import { SSHExecCommandResponse } from 'node-ssh';
import { SunshineMoonlightPairer, SunshineMoonlightPairerArgs } from '../../../../../src/core/moonlight/pairer/sunshine';
import { SSHClient } from '../../../../../src/tools/ssh';

/**
 * Build a SSH command response as returned by SSHClient.command
 */
function sshResponse(stdout: string): SSHExecCommandResponse {
    return { stdout, stderr: '', code: 0, signal: '' }
}

describe('SunshineMoonlightPairer', () => {

    const pairerArgs: SunshineMoonlightPairerArgs = {
        instanceName: 'test-instance',
        host: '1.2.3.4',
        ssh: {
            clientName: 'test-client',
            host: '1.2.3.4',
            user: 'test',
            privateKeyPath: '/tmp/test-key',
        },
        sunshine: {
            username: 'sunshine',
            password: 'test-password',
        }
    }

    let pairer: SunshineMoonlightPairer
    let sshCommandStub: sinon.SinonStub
    let sshConnectStub: sinon.SinonStub
    let sshDisposeStub: sinon.SinonStub

    interface PendingPairing {
        id: string
        name?: string
        address?: string
    }

    function stubSshResponses(getResult: SSHExecCommandResponse, postResult: SSHExecCommandResponse) {
        sshCommandStub = sinon.stub(SSHClient.prototype, 'command').callsFake(async (cmd: string[]) => {
            if (cmd.includes('POST')) {
                return postResult
            }
            return getResult
        })
    }

    function pendingPairings(pairings: PendingPairing[]): SSHExecCommandResponse {
        return sshResponse(JSON.stringify({ pairings }))
    }

    function pinResult(status: string | boolean): SSHExecCommandResponse {
        return sshResponse(JSON.stringify({ status }))
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

        it('should generate a PIN, print the moonlight pair command and send the PIN', async () => {
            stubSshResponses(
                pendingPairings([{ id: 'a'.repeat(32) }]),
                pinResult('true'),
            )

            await pairer.pairAuto()

            assert.ok(sshCommandStub.calledTwice, 'a GET (list pairings) then a POST (confirm pin) must be run')
            const postCall = sshCommandStub.secondCall.args[0] as string[]
            const payload = JSON.parse(postCall[postCall.length - 1])
            assert.match(payload.pin, /^\d{4}$/)
        })

    })

    describe('pairSendPin', () => {

        it('should pair successfully when a single pending pairing exists and Sunshine confirms the PIN', async () => {
            stubSshResponses(
                pendingPairings([{ id: 'a'.repeat(32) }]),
                pinResult('true'),
            )

            const result = await pairer.pairSendPin('1234', 1, 0)
            assert.strictEqual(result, true)
            assert.ok(sshCommandStub.calledTwice, 'a GET (list pairings) then a POST (confirm pin) must be run')

            const postCall = sshCommandStub.secondCall.args[0] as string[]
            const payload = JSON.parse(postCall[postCall.length - 1])
            assert.strictEqual(payload.pairing_id, 'a'.repeat(32))
            assert.strictEqual(payload.pin, '1234')
            assert.strictEqual(payload.name, pairerArgs.instanceName)
        })

        it('should confirm pairing when Sunshine responds with boolean true', async () => {
            stubSshResponses(
                pendingPairings([{ id: 'b'.repeat(32) }]),
                pinResult(true),
            )

            const result = await pairer.pairSendPin('1234', 1, 0)
            assert.strictEqual(result, true)
        })

        it('should fail when no pending pairing session exists (Moonlight not waiting for a PIN)', async () => {
            stubSshResponses(
                pendingPairings([]),
                pinResult(true),
            )

            await assert.rejects(pairer.pairSendPin('1234', 1, 0))
            assert.ok(sshCommandStub.calledOnce, 'no PIN POST must be sent when there is no pending pairing')
        })

        it('should skip PIN attempt when multiple pending pairing sessions exist to avoid pairing the wrong client', async () => {
            stubSshResponses(
                pendingPairings([{ id: 'c'.repeat(32) }, { id: 'd'.repeat(32) }]),
                pinResult(true),
            )

            await assert.rejects(pairer.pairSendPin('1234', 1, 0))
            assert.ok(sshCommandStub.calledOnce, 'no PIN POST must be sent with multiple pending pairings')
        })

        it('should fail when listing pending pairings returns invalid JSON', async () => {
            stubSshResponses(
                sshResponse('not-json'),
                pinResult('true'),
            )

            await assert.rejects(pairer.pairSendPin('1234', 1, 0))
            assert.ok(sshCommandStub.calledOnce, 'no PIN POST must be sent when pending pairings cannot be listed')
        })

        it('should fail when Sunshine confirms with an error status', async () => {
            stubSshResponses(
                pendingPairings([{ id: 'e'.repeat(32) }]),
                pinResult('false'),
            )

            await assert.rejects(pairer.pairSendPin('1234', 1, 0))
        })

        it('should retry when first attempt fails and succeed on second attempt', async () => {
            sshCommandStub = sinon.stub(SSHClient.prototype, 'command').callsFake(async (cmd: string[]) => {
                if (cmd.includes('POST')) {
                    return pinResult('true')
                }
                // First listing: empty (Moonlight not ready yet), then a pending pairing appears
                if (sshCommandStub.callCount === 1) {
                    return pendingPairings([])
                }
                return pendingPairings([{ id: 'f'.repeat(32) }])
            })

            const result = await pairer.pairSendPin('1234', 2, 0)
            assert.strictEqual(result, true)
            assert.strictEqual(sshConnectStub.callCount, 2, 'SSH client must be reconnected on each attempt')
        })

    })

})
