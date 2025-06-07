import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../../src/cli/initializer';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY } from '../../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS, getUnitTestCoreClient, getUnitTestCoreConfig } from '../../utils';
import { DummyInstanceInput, DummyInstanceStateV1, DummyProvisionInputV1 } from '../../../../src/providers/dummy/state';
import { CommonConfigurationInputV1 } from '../../../../src/core/state/state';
import { ServerRunningStatus } from '../../../../src/core/runner';
import { DummyProviderClient } from '../../../../src/providers/dummy/provider';

describe('Dummy instance lifecycle', () => {

    const coreConfig = getUnitTestCoreConfig()

    const DUMMY_INSTANCE_NAME = "dummy-instance-lifecycle-test"
    const DUMMY_INSTANCE_TYPE = "dummy-instance-lifecycle-test-type-1"

    const DUMMY_INSTANCE_INPUT: DummyInstanceInput = {
        instanceName: DUMMY_INSTANCE_NAME,
        configuration: {
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
        },
        provision: {
            instanceType: DUMMY_INSTANCE_TYPE,
            startDelaySeconds: 0,
            stopDelaySeconds: 0,
            configurationDelaySeconds: 0,
            provisioningDelaySeconds: 0,
            readinessAfterStartDelaySeconds: 0,
            initialServerStateAfterProvision: "running",
            ssh: {
                user: "dummy-user",
                privateKeyContentBase64: "dummy-private-key-content-base64"
            }
        }
    }
    const DUMMY_CLI_ARGS: DummyCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: DUMMY_INSTANCE_NAME,
        instanceType: DUMMY_INSTANCE_TYPE,
        overwriteExisting: true,
        startDelaySeconds: DUMMY_INSTANCE_INPUT.provision.startDelaySeconds,
        stopDelaySeconds: DUMMY_INSTANCE_INPUT.provision.stopDelaySeconds
    }

    it('should initialize a new Dummy instance', async () => {

        const providerClient = new DummyProviderClient({ config: coreConfig })
        const initializer = providerClient.getInstanceInitializer()
        await initializer.initializeStateOnly(DUMMY_INSTANCE_NAME, DUMMY_INSTANCE_INPUT.provision, DUMMY_INSTANCE_INPUT.configuration)

        const loader = providerClient.getStateLoader()
        const state = await loader.loadInstanceState(DUMMY_INSTANCE_NAME)
    })

    it('should provision and configure Dummy instance', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)

        const detailsBeforeProvision = await manager.getInstanceStatus()
        assert.equal(detailsBeforeProvision.serverStatus, ServerRunningStatus.Unknown, 'Instance should be in unknown state after initialization without provisioning')
        const provisionStatusBeforeProvision = await manager.isProvisioned()
        assert.equal(provisionStatusBeforeProvision, false, 'Instance should not be provisioned before provisioning')
        const configureStatusBeforeConfigure = await manager.isConfigured()
        assert.equal(configureStatusBeforeConfigure, false, 'Instance should not be configured before configuring')

        await manager.provision()

        const provisionStatusAfterProvision = await manager.isProvisioned() 
        assert.equal(provisionStatusAfterProvision, true, 'Instance should be provisioned after provisioning')
        const configureStatusAfterProvision = await manager.isConfigured()
        assert.equal(configureStatusAfterProvision, false, 'Instance should not be configured after provisioning')
        const detailsAfterProvision = await manager.getInstanceStatus()
        assert.equal(detailsAfterProvision.serverStatus, ServerRunningStatus.Running, 'Instance should be in running state after provisioning')

        await manager.configure()

        const provisionStatusAfterConfigure = await manager.isProvisioned()
        assert.equal(provisionStatusAfterConfigure, true, 'Instance should be provisioned after configuring')
        const configureStatusAfterConfigure = await manager.isConfigured()
        assert.equal(configureStatusAfterConfigure, true, 'Instance should be configured after configuring')
        const detailsAfterConfigure = await manager.getInstanceStatus()
        assert.equal(detailsAfterConfigure.serverStatus, ServerRunningStatus.Running, 'Instance should be in running state after configuring')
    })

    it('should start, stop, and restart the Dummy instance', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)

        const detailsBeforeStart = await manager.getInstanceStatus()   
        assert.equal(detailsBeforeStart.serverStatus, ServerRunningStatus.Running, 'Instance should be running before stop test')
        assert.equal(detailsBeforeStart.ready, true, 'Instance should be ready before stop test')

        await manager.stop({ wait: true })
        const detailsAfterStop = await manager.getInstanceStatus()
        assert.equal(detailsAfterStop.serverStatus, ServerRunningStatus.Stopped, 'Instance should be stopped after stop')
        assert.equal(detailsAfterStop.ready, false, 'Instance should not be ready after stop')

        await manager.start({ wait: true })
        const detailsAfterStart = await manager.getInstanceStatus()    
        assert.equal(detailsAfterStart.serverStatus, ServerRunningStatus.Running, 'Instance should be running after start')        
        assert.equal(detailsAfterStart.ready, true, 'Instance should be ready after start')

        await manager.restart({ wait: true })
        const detailsAfterRestart = await manager.getInstanceStatus()
        assert.equal(detailsAfterRestart.serverStatus, ServerRunningStatus.Running, 'Instance should be running after restart')
        assert.equal(detailsAfterStart.ready, true, 'Instance should be ready after start')
    }).timeout(20000)

    it('should destroy the Dummy instance', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.destroy()
    })

    it("should initialize with InteractiveInstanceInitializer without prompting", async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        await new InteractiveInstanceInitializer<DummyInstanceStateV1, DummyCreateCliArgs>({ 
            initArgs: DUMMY_CLI_ARGS,
            inputPrompter: new DummyInputPrompter({ coreConfig: coreConfig }),
            providerClient: providerClient
        }).initializeInteractive({ skipPostInitInfo: true })
    })

    it("should initialize with given initial server status", async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const initializer = providerClient.getInstanceInitializer()

        const instanceUndefinedInitialServerState = "instance-undefined-initial-server-state"
        await initializer.initializeStateOnly(instanceUndefinedInitialServerState, {
            ...DUMMY_INSTANCE_INPUT.provision,
            initialServerStateAfterProvision: undefined
        }, DUMMY_INSTANCE_INPUT.configuration)

        const managerUndefinedInitialServerState = await providerClient.getInstanceManager(instanceUndefinedInitialServerState)
        await managerUndefinedInitialServerState.provision()
        const detailsUndefinedInitialServerState = await managerUndefinedInitialServerState.getInstanceStatus()
        assert.equal(detailsUndefinedInitialServerState.serverStatus, ServerRunningStatus.Running)

        // running
        const instanceRunningInitialServerState = "instance-running-initial-server-state"
        await initializer.initializeStateOnly(instanceRunningInitialServerState, {
            ...DUMMY_INSTANCE_INPUT.provision,
            initialServerStateAfterProvision: ServerRunningStatus.Running
        }, DUMMY_INSTANCE_INPUT.configuration)
        const managerRunningInitialServerState = await providerClient.getInstanceManager(instanceRunningInitialServerState)
        await managerRunningInitialServerState.provision()
        const detailsRunningInitialServerState = await managerRunningInitialServerState.getInstanceStatus()
        assert.equal(detailsRunningInitialServerState.serverStatus, ServerRunningStatus.Running)

        // stopped
        const instanceStoppedInitialServerState = "instance-stopped-initial-server-state"
        await initializer.initializeStateOnly(instanceStoppedInitialServerState, {
            ...DUMMY_INSTANCE_INPUT.provision,
            initialServerStateAfterProvision: ServerRunningStatus.Stopped
        }, DUMMY_INSTANCE_INPUT.configuration)
        const managerStoppedInitialServerState = await providerClient.getInstanceManager(instanceStoppedInitialServerState)
        await managerStoppedInitialServerState.provision()
        const detailsStoppedInitialServerState = await managerStoppedInitialServerState.getInstanceStatus()
        assert.equal(detailsStoppedInitialServerState.serverStatus, ServerRunningStatus.Stopped)

    })
})
