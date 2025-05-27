import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../../src/cli/initializer';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY } from '../../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS, getUnitTestCoreClient } from '../../utils';
import { DummyInstanceInput, DummyProvisionInputV1 } from '../../../../src/providers/dummy/state';
import { CommonConfigurationInputV1 } from '../../../../src/core/state/state';
import { ServerRunningStatus } from '../../../../src/core/runner';

describe('Should destroy instance server on stop and recreate it on start', () => {

    const DUMMY_INSTANCE_NAME = "dummy-instance-destroy-server-on-stop"
    const DUMMY_INSTANCE_TYPE = "dummy-instance-type"

    const DUMMY_INSTANCE_INPUT: DummyInstanceInput = {
        instanceName: DUMMY_INSTANCE_NAME,
        configuration: {
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
        },
        provision: {
            deleteInstanceServerOnStop: true,
            instanceType: DUMMY_INSTANCE_TYPE,
            startDelaySeconds: 0,
            stopDelaySeconds: 0,
            configurationDelaySeconds: 0,
            provisioningDelaySeconds: 0,
            readinessAfterStartDelaySeconds: 0,
            initialServerStateAfterProvision: "running",
            ssh: {
                user: "dummy-user",
                privateKeyContentBase64: String(Buffer.from("dummy-private-key-content-base64", "base64"))
            }
        }
    }

    it('should create dummy instance server', async () => {
        const coreClient = getUnitTestCoreClient()
        const initializer = coreClient.buildInstanceInitializer<DummyProvisionInputV1, CommonConfigurationInputV1>(CLOUDYPAD_PROVIDER_DUMMY)
        await initializer.initializeStateOnly(DUMMY_INSTANCE_NAME, DUMMY_INSTANCE_INPUT.provision, DUMMY_INSTANCE_INPUT.configuration)
        
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.deploy()

        const status = await manager.getInstanceStatus()
        assert.equal(status.serverStatus, ServerRunningStatus.Running, 'Instance server should be running')
        assert.equal(status.ready, true, 'Instance should be ready')
    })

    it('should destroy dummy instance server on stop', async () => {
        const coreClient = getUnitTestCoreClient()
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.stop()

        // after stop, instance server should be in unknown
        // not ready, not configured but partially provisioned
        const status = await manager.getInstanceStatus()
        assert.equal(status.serverStatus, ServerRunningStatus.Unknown, 'Instance server should be unknown')
        assert.equal(status.ready, false, 'Instance should not be ready')

        const isConfigured = await manager.isConfigured()
        assert.equal(isConfigured, false, 'Instance should not be configured after stop')

        const isProvisioned = await manager.isProvisioned()
        assert.equal(isProvisioned, true, 'Instance should be provisioned after stop')
    })

    it('should recreate dummy instance server on start', async () => {
        const coreClient = getUnitTestCoreClient()
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.start()

        const status = await manager.getInstanceStatus()
        assert.equal(status.serverStatus, ServerRunningStatus.Running, 'Instance server should be running')
        assert.equal(status.ready, true, 'Instance should be ready')

        const isConfigured = await manager.isConfigured()
        assert.equal(isConfigured, true, 'Instance should be configured after start')

        const isProvisioned = await manager.isProvisioned()
        assert.equal(isProvisioned, true, 'Instance should be provisioned after start')
    })

})