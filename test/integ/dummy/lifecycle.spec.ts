import * as assert from 'assert';
import { CLOUDYPAD_PROVIDER_DUMMY } from '../../../src/core/const';
import { DummyProvisionInputV1 } from '../../../src/providers/dummy/state';
import { ServerRunningStatus } from '../../../src/core/runner';
import { DummyInstanceInput } from '../../../src/providers/dummy/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE } from '../../../src/core/const';
import { getUnitTestCoreClient, getUnitTestCoreConfig } from '../../unit/utils';
import { CommonConfigurationInputV1 } from '../../../src/core/state/state';
import { DummyProviderClient } from '../../../src/providers/dummy/provider';

describe('Dummy instance lifecycle with delay', () => {

    const DUMMY_INSTANCE_NAME = "dummy-instance-integ-lifecycle-test"
    const DUMMY_INSTANCE_TYPE = "dummy-instance-type-1"

    const DUMMY_INSTANCE_INPUT: DummyInstanceInput = {
        instanceName: DUMMY_INSTANCE_NAME,
        configuration: {
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
        },
        provision: {
            instanceType: DUMMY_INSTANCE_TYPE,
            startDelaySeconds: 1,
            stopDelaySeconds: 1,
            configurationDelaySeconds: 1,
            provisioningDelaySeconds: 1,
            readinessAfterStartDelaySeconds: 1,
            initialServerStateAfterProvision: "running",
            ssh: {
                user: "dummy-user",
            }
        }
    }

    it('should ensure dummy infra status is updated correctly on action', async () => {
        const coreConfig = getUnitTestCoreConfig()
        const dummyProviderClient = new DummyProviderClient({ config: coreConfig })
        const initializer = dummyProviderClient.getInstanceInitializer()
        await initializer.initializeStateOnly(DUMMY_INSTANCE_NAME, DUMMY_INSTANCE_INPUT.provision, DUMMY_INSTANCE_INPUT.configuration)

        const manager = await dummyProviderClient.getInstanceManager(DUMMY_INSTANCE_NAME)

        const statusBeforeProvision = await manager.getInstanceStatus()
        assert.equal(statusBeforeProvision.provisioned, false, 'Instance should not be provisioned before provisioning')
        assert.equal(statusBeforeProvision.configured, false, 'Instance should not be configured before provisioning')
        assert.equal(statusBeforeProvision.serverStatus, ServerRunningStatus.Unknown, 'Instance should be stopped before provisioning')
        assert.equal(statusBeforeProvision.ready, false, 'Instance should not be ready before provisioning')

        const provisionStartTime = Date.now()
        await manager.provision()
        const provisionEndTime = Date.now()

        assert.ok(provisionEndTime - provisionStartTime >= 1000 && provisionEndTime - provisionStartTime < 1200, 
            'Provisioning should take at least 1 second but less than 1.2 seconds. Got: ' + (provisionEndTime - provisionStartTime) + 'ms');

        const statusAfterProvision = await manager.getInstanceStatus()
        assert.equal(statusAfterProvision.provisioned, true, 'Instance should be provisioned after provisioning')
        assert.equal(statusAfterProvision.configured, false, 'Instance should not be configured after provisioning')
        assert.equal(statusAfterProvision.serverStatus, ServerRunningStatus.Running, 'Instance should be running after provisioning')
        assert.equal(statusAfterProvision.ready, false, 'Instance should not be ready before provisioning')

        const configureStartTime = Date.now()
        await manager.configure()   
        const configureEndTime = Date.now()

        assert.ok(configureEndTime - configureStartTime >= 1000 && configureEndTime - configureStartTime < 1200, 
            'Configuration should take at least 1 second but less than 1.2 seconds. Got: ' + (configureEndTime - configureStartTime) + 'ms');

        const statusAfterConfigure = await manager.getInstanceStatus()
        assert.equal(statusAfterConfigure.provisioned, true, 'Instance should be provisioned after configure')
        assert.equal(statusAfterConfigure.configured, true, 'Instance should be configured after configure')
        assert.equal(statusAfterConfigure.serverStatus, ServerRunningStatus.Running, 'Instance should be running after configure')
        assert.equal(statusAfterConfigure.ready, true, 'Instance should be ready after configure')

        await manager.stop()

        const statusAfterStop = await manager.getInstanceStatus()
        assert.equal(statusAfterStop.provisioned, true, 'Instance should be provisioned after stop')
        assert.equal(statusAfterStop.configured, true, 'Instance should be configured after stop')
        assert.equal(statusAfterStop.serverStatus, ServerRunningStatus.Stopping, 'Instance should be stopping after stop')
        assert.equal(statusAfterStop.ready, false, 'Instance should not be ready after stop')

        await new Promise(resolve => setTimeout(resolve, 1000))

        const statusAfterStopDelay = await manager.getInstanceStatus()
        assert.equal(statusAfterStopDelay.provisioned, true, 'Instance should be provisioned after stop delay')
        assert.equal(statusAfterStopDelay.configured, true, 'Instance should be configured after stop delay')
        assert.equal(statusAfterStopDelay.serverStatus, ServerRunningStatus.Stopped, 'Instance should be stopped after stop delay')
        assert.equal(statusAfterStopDelay.ready, false, 'Instance should not be ready after stop delay')

        await manager.start()
        const statusAfterStart = await manager.getInstanceStatus()

        assert.equal(statusAfterStart.provisioned, true, 'Instance should be provisioned after start')
        assert.equal(statusAfterStart.configured, true, 'Instance should be configured after start')
        assert.equal(statusAfterStart.serverStatus, ServerRunningStatus.Starting, 'Instance should be starting after start')
        assert.equal(statusAfterStart.ready, false, 'Instance should not be ready right after start')

        await new Promise(resolve => setTimeout(resolve, 1000))

        const statusAfterStartDelay = await manager.getInstanceStatus()
        assert.equal(statusAfterStartDelay.provisioned, true, 'Instance should be provisioned after start delay')
        assert.equal(statusAfterStartDelay.configured, true, 'Instance should be configured after start delay')
        assert.equal(statusAfterStartDelay.serverStatus, ServerRunningStatus.Running, 'Instance should be starting after start')
        assert.equal(statusAfterStartDelay.ready, false, 'Instance should not be ready right after start')

        // sleep to wait for readiness
        await new Promise(resolve => setTimeout(resolve, 1000))

        const statusAfterReadinessDelay = await manager.getInstanceStatus()
        assert.equal(statusAfterReadinessDelay.provisioned, true, 'Instance should be provisioned after start')
        assert.equal(statusAfterReadinessDelay.configured, true, 'Instance should be configured after start')
        assert.equal(statusAfterReadinessDelay.serverStatus, ServerRunningStatus.Running, 'Instance should be running after start')
        assert.equal(statusAfterReadinessDelay.ready, true, 'Instance should be ready 1 second after start')

        
    }).timeout(20000)

})
