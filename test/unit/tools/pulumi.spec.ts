import * as assert from 'assert'
import * as sinon from 'sinon'
import { InstancePulumiClient, InstancePulumiClientArgs } from '../../../src/tools/pulumi/client'
import { ConcurrentUpdateError, OutputMap } from '@pulumi/pulumi/automation'
import { error } from 'console'

// Mock implementation for testing
class MockInstancePulumiClient extends InstancePulumiClient<{ test: string }, { output: string }> {
    async doSetConfig(config: { test: string }): Promise<void> {
        // no-op
    }

    async buildTypedOutput(outputs: OutputMap): Promise<{ output: string }> {
        return { output: 'test-output' }
    }
}

describe('InstancePulumiClient', () => {
    let sandbox: sinon.SinonSandbox
    let mockStack: any
    let client: MockInstancePulumiClient

    function buildTestClient() {
        return new MockInstancePulumiClient({
            program: () => Promise.resolve({}),
            projectName: 'test-project',
            stackName: 'test-stack',
            clientOptions: {
                retry: {
                    maxRetries: 3,
                    retryDelay: 0, // 0 delay for testing, test will count funtion calls
                    logBehavior: "debug"
                }
            }
        })
    }

    describe('Pulumi client retry logic', () => {
        it('should retry on ConcurrentUpdateError and succeed on third attempt', async () => {
            const concurrentError = new ConcurrentUpdateError('Mock concurrent update error for testing')
            const client = buildTestClient() 
            
            const scenarios = [
                { actionName: 'up', action: async () => { await client.up() }, stub: sinon.stub(client, '_doUp') },
                { actionName: 'preview', action: async () => { await client.preview() }, stub: sinon.stub(client, '_doPreview') },
                { actionName: 'destroy', action: async () => { await client.destroy() }, stub: sinon.stub(client, '_doDestroy') }, 
                { actionName: 'refresh', action: async () => { await client.refresh() }, stub: sinon.stub(client, '_doRefresh') },
            ]

            for (const scenario of scenarios) {
                scenario.stub
                    .onFirstCall().rejects(concurrentError)
                    .onSecondCall().rejects(concurrentError)
                    .onThirdCall().resolves()

                await scenario.action()

                assert.strictEqual(scenario.stub.callCount, 3, `Expected 3 calls for action '${scenario.actionName}'`)
            }
        })

        it('should retry on ConcurrentUpdateError and fail after max retries', async () => {
            const concurrentError = new ConcurrentUpdateError('Mock concurrent update error for testing')
            const client = buildTestClient() 

            const scenarios = [
                { actionName: 'up', action: async () => { await client.up() }, stub: sinon.stub(client, '_doUp') },
                { actionName: 'preview', action: async () => { await client.preview() }, stub: sinon.stub(client, '_doPreview') },
                { actionName: 'destroy', action: async () => { await client.destroy() }, stub: sinon.stub(client, '_doDestroy') }, 
                { actionName: 'refresh', action: async () => { await client.refresh() }, stub: sinon.stub(client, '_doRefresh') },
            ]

            for (const scenario of scenarios) {
                scenario.stub
                    .rejects(concurrentError)

                await assert.rejects(async () => {
                    await scenario.action()
                })
                assert.strictEqual(scenario.stub.callCount, 4)
            }
            
        })

        it('should not retry on non-ConcurrentUpdateError', async () => {
            const otherError = new Error('Some other error')
            const client = buildTestClient() 

            const scenarios = [
                { actionName: 'up', action: async () => { await client.up() }, stub: sinon.stub(client, '_doUp') },
                { actionName: 'preview', action: async () => { await client.preview() }, stub: sinon.stub(client, '_doPreview') },
                { actionName: 'destroy', action: async () => { await client.destroy() }, stub: sinon.stub(client, '_doDestroy') }, 
                { actionName: 'refresh', action: async () => { await client.refresh() }, stub: sinon.stub(client, '_doRefresh') },
            ]

            for (const scenario of scenarios) {
                scenario.stub.rejects(otherError)

                await assert.rejects(async () => {
                    await scenario.action()
                })
                assert.strictEqual(scenario.stub.callCount, 1)
            }
        })

        it('should succeed immediately when no error occurs', async () => {
            const client = buildTestClient() 

            const scenarios = [
                { actionName: 'up', action: async () => { await client.up() }, stub: sinon.stub(client, '_doUp') },
                { actionName: 'preview', action: async () => { await client.preview() }, stub: sinon.stub(client, '_doPreview') },
                { actionName: 'destroy', action: async () => { await client.destroy() }, stub: sinon.stub(client, '_doDestroy') }, 
                { actionName: 'refresh', action: async () => { await client.refresh() }, stub: sinon.stub(client, '_doRefresh') },
            ]

            for (const scenario of scenarios) {
                scenario.stub.resolves()

                const result = await scenario.action()

                assert.strictEqual(scenario.stub.callCount, 1)
            }
        })
    })
})
