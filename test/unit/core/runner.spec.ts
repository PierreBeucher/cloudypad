import * as assert from 'assert';
import sinon from 'sinon';
import { createDummyInstance, getUnitTestCoreConfig } from '../utils';
import { ServerRunningStatus } from '../../../src/core/runner';
import { getLogger } from '../../../src/log/utils';
import { DummyInstanceRunner } from '../../../src/providers/dummy/runner';
import { DummyInstanceInfraManager } from '../../../src/providers/dummy/infra';

describe('InstanceRunner', () => {
    const logger = getLogger("InstanceRunner test")
    const coreConfig = getUnitTestCoreConfig()

    describe('serverStatus', () => {
        it('should return Unknown when doGetInstanceStatus throws an error', async () => {

            const instanceName = 'test-instance-instance-status-no-fail-on-server-check-failure'
            const dummyState = await createDummyInstance(instanceName)

            const dummyInfraManager = new DummyInstanceInfraManager({
                instanceName: instanceName,
                coreConfig: coreConfig
            })

            await dummyInfraManager.setServerRunningStatus(ServerRunningStatus.Running)

            const runner = new DummyInstanceRunner({
                instanceName: instanceName,
                provisionInput: dummyState.provision.input,
                provisionOutput: {
                    ...dummyState.provision.output,
                    host: "127.0.0.1",
                    instanceId: "instance-id",
                    provisionedAt: Date.now(),
                    dataDiskId: "data-disk-id",
                },
                configurationInput: dummyState.configuration.input,
                dummyInfraManager: dummyInfraManager
            })

            // avoid false positive error: ensure without mocking, the serverStatus will return Running
            const resultNoMock = await runner.serverStatus()
            assert.strictEqual(resultNoMock, ServerRunningStatus.Running)

            sinon.stub(runner, 'doGetInstanceStatus').throws(new Error('test error'))  

            const result = await runner.serverStatus()
            assert.strictEqual(result, ServerRunningStatus.Unknown)
        });
    });
});
