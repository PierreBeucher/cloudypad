import * as assert from 'assert';
import { CLOUDYPAD_PROVIDER_DUMMY} from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT, getUnitTestCoreClient } from '../utils';
import { InstanceInitializer } from '../../../src/core/initializer';
import { CommonConfigurationInputV1 } from '../../../src/core/state/state';
import { DummyProvisionInputV1 } from '../../../src/providers/dummy/state';
import { InstanceStatus } from '../../../src/core/manager';
import { ServerRunningStatus } from '../../../src/core/runner';

describe('Instance manager', () => {

    it('should be able to start, stop and restart an instance with expected status at every step', async () => {
        const client = getUnitTestCoreClient()
        const instanceName = "dummy-test-core-manager"
        
        const initiliazer = new InstanceInitializer<DummyProvisionInputV1, CommonConfigurationInputV1>({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            stateWriter: client.buildEmptyStateWriter(),
        })
        
        await initiliazer.initializeStateOnly(instanceName,
            {
                ...DEFAULT_COMMON_INPUT.provision,
                instanceType: "dummy-instance-type-1",
                startDelaySeconds: 0,
                stopDelaySeconds: 0,
            },
            {
                ...DEFAULT_COMMON_INPUT.configuration,
            }
        )

        const manager = await client.buildInstanceManager(instanceName)

        // right after init, the instance should be in a stopped state
        // and status should be returned accordingly
        const actualStatusAfterInit = await manager.getInstanceStatus()
        const expectedStatusAfterInit: InstanceStatus = {
            provisioned: false,
            configured: false,
            serverStatus: ServerRunningStatus.Unknown,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterInit, expectedStatusAfterInit)

        // provision the instance
        await manager.provision()
        const actualStatusAfterProvision = await manager.getInstanceStatus()
        const expectedStatusAfterProvision: InstanceStatus = {
            provisioned: true,
            configured: false,
            serverStatus: ServerRunningStatus.Running,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterProvision, expectedStatusAfterProvision)

        // dummy instance is not automatically started after provision, do it manually
        await manager.start()

        // configure the instance
        await manager.configure()
        const actualStatusAfterConfigure = await manager.getInstanceStatus()
        const expectedStatusAfterConfigure: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterConfigure, expectedStatusAfterConfigure)

        // stop and start instance
        await manager.stop()
        const actualStatusAfterStop = await manager.getInstanceStatus()
        const expectedStatusAfterStop: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Stopped,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterStop, expectedStatusAfterStop)

        await manager.start()
        const actualStatusAfterStart = await manager.getInstanceStatus()
        const expectedStatusAfterStart: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterStart, expectedStatusAfterStart)

        // restart the instance
        await manager.restart()
        const actualStatusAfterRestart = await manager.getInstanceStatus()
        const expectedStatusAfterRestart: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }

        await manager.deploy()
        const actualStatusAfterDeploy = await manager.getInstanceStatus()
        const expectedStatusAfterDeploy: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterDeploy, expectedStatusAfterDeploy)

        // destroy the instance
        await manager.destroy()
        const actualStatusAfterDestroy = await manager.getInstanceStatus()
        const expectedStatusAfterDestroy: InstanceStatus = {
            provisioned: false,
            configured: false,
            serverStatus: ServerRunningStatus.Unknown,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterDestroy, expectedStatusAfterDestroy)
    })
})
