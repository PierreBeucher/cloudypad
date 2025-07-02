import * as assert from 'assert'
import { Retrier } from '../../../src/tools/retrier'

describe('Retrier', () => {
    it('should execute action once when retries is 0', async () => {
        let callCount = 0
        const actionFn = async () => {
            callCount++
            return 'success'
        }

        const retrier = new Retrier({
            actionFn,
            actionName: 'test-action-success',
            retries: 0,
            retryDelaySeconds: 0,
            onRetryLogBehavior: 'silent'
        })

        const result = await retrier.run()

        assert.strictEqual(result, 'success')
        assert.strictEqual(callCount, 1)
    })

    it('should retry and succeed after a few attempts', async () => {
        let callCount = 0
        const actionFn = async () => {
            callCount++
            if (callCount < 3) {
                throw new Error('temporary failure')
            }
            return 'success'
        }

        const retrier = new Retrier({
            actionFn,
            actionName: 'test-action-success-after-3-attempts)',
            retries: 3,
            retryDelaySeconds: 0,
            onRetryLogBehavior: 'silent'
        })

        const result = await retrier.run()

        assert.strictEqual(result, 'success')
        assert.strictEqual(callCount, 3)
    })

    it('should fail after all retries are exhausted', async () => {
        let callCount = 0
        const actionFn = async () => {
            callCount++
            throw new Error('persistent failure')
        }

        const retrier = new Retrier({
            actionFn,
            actionName: 'test-action-fail',
            retries: 2,
            retryDelaySeconds: 0,
            onRetryLogBehavior: 'silent'
        })

        try {
            await retrier.run()
            assert.fail('Expected error to be thrown')
        } catch (error) {
            assert.ok(error instanceof Error)
            const errorMessage = (error as Error).message
            assert.strictEqual(errorMessage, 'test-action-fail failed after 3 attempts.')
            assert.strictEqual(callCount, 3)
        }
    })
})
