import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../../src/cli/initializer';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY } from '../../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS, getUnitTestCoreClient, getUnitTestCoreConfig } from '../../utils';
import { DummyInstanceInput, DummyInstanceStateV1, DummyProvisionInputV1 } from '../../../../src/providers/dummy/state';
import { CommonConfigurationInputV1 } from '../../../../src/core/state/state';
import { ServerRunningStatus } from '../../../../src/core/runner';
import { DummyProviderClient } from '../../../../src/providers/dummy/provider';
import { DummyInstanceInfraManager } from '../../../../src/providers/dummy/infra';

describe('Dummy instance lifecycle', () => {

    const coreConfig = getUnitTestCoreConfig()

    const DUMMY_INSTANCE_NAME = "dummy-instance-lifecycle-with-snapshot-test"
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
            },
            baseImageSnapshot: {
                enable: true,
            },
            deleteInstanceServerOnStop: true,
            dataDiskSnapshot: {
                enable: true,
            },
            dataDiskSizeGb: 50,
        }
    }

    async function getCurrentTestState(): Promise<DummyInstanceStateV1> {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        return providerClient.getInstanceState(DUMMY_INSTANCE_NAME)
    }

    async function getDummyInfraManager(): Promise<DummyInstanceInfraManager> {
        return new DummyInstanceInfraManager({
            instanceName: DUMMY_INSTANCE_NAME,
            coreConfig: coreConfig
        })
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

    it('should deploy instance with base image snapshot', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)
        const infraManager = await getDummyInfraManager()

        const detailsBeforeDeploy = await manager.getInstanceStatus()
        assert.equal(detailsBeforeDeploy.serverStatus, ServerRunningStatus.Unknown, 'Instance should be in unknown state after initialization without provisioning')
        const provisionStatusBeforeDeploy = await manager.isProvisioned()
        assert.equal(provisionStatusBeforeDeploy, false, 'Instance should not be provisioned before deploy')
        const configureStatusBeforeDeploy = await manager.isConfigured()
        assert.equal(configureStatusBeforeDeploy, false, 'Instance should not be configured before deploy')

        await manager.deploy()

        const provisionStatusAfterDeploy = await manager.isProvisioned() 
        assert.equal(provisionStatusAfterDeploy, true, 'Instance should be provisioned after deploy')
        const configureStatusAfterDeploy = await manager.isConfigured()
        assert.equal(configureStatusAfterDeploy, true, 'Instance should be configured after deploy')
        const detailsAfterDeploy = await manager.getInstanceStatus()
        assert.equal(detailsAfterDeploy.serverStatus, ServerRunningStatus.Running, 'Instance should be in running state after deploy')

        // Check infrastructure after deploy
        const state = await getCurrentTestState()
        assert.ok(state.provision.output?.instanceId, "Instance ID should be set after deploy")
        assert.ok(state.provision.output?.rootDiskId, "Root disk ID should be set after deploy")
        assert.ok(state.provision.output?.dataDiskId, "Data disk ID should be set after deploy")
        assert.ok(state.provision.output?.baseImageId, "Base image ID should be set after deploy")

        // Verify infrastructure matches state output
        const infra = await infraManager.getInstanceInfra()
        assert.strictEqual(infra?.serverId, state.provision.output?.instanceId, "Server ID should match between state and infra")
        assert.strictEqual(infra?.rootDiskId, state.provision.output?.rootDiskId, "Root disk ID should match between state and infra")
        assert.strictEqual(infra?.dataDiskId, state.provision.output?.dataDiskId, "Data disk ID should match between state and infra")
        assert.strictEqual(infra?.baseImageId, state.provision.output?.baseImageId, "Base image ID should match between state and infra")
    })

    it('should stop instance and create data disk snapshot', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)
        const infraManager = await getDummyInfraManager()

        const curState = await manager.getState()
        console.info(JSON.stringify(curState, null, 2))

        await manager.stop({ wait: true })
        const detailsAfterStop = await manager.getInstanceStatus()
        assert.equal(detailsAfterStop.serverStatus, ServerRunningStatus.Unknown, 'Instance should be in unknown state after stop (server deleted)')
        assert.equal(detailsAfterStop.ready, false, 'Instance should not be ready after stop')

        // Check infrastructure after stop
        const stateAfterStop = await getCurrentTestState()
        assert.strictEqual(stateAfterStop.provision.output?.instanceId, undefined, "Instance ID should be undefined after stop (server deleted)")
        assert.strictEqual(stateAfterStop.provision.output?.dataDiskId, undefined, "Data disk ID should be undefined after stop")
        assert.ok(stateAfterStop.provision.output?.dataDiskSnapshotId, "Data disk snapshot ID should be set after stop")

        const infraAfterStop = await infraManager.getInstanceInfra()
        assert.strictEqual(infraAfterStop?.serverId, undefined, "Server ID should be undefined in infra after stop")
        assert.strictEqual(infraAfterStop?.dataDiskId, undefined, "Data disk ID should be undefined in infra after stop")
        assert.strictEqual(infraAfterStop?.dataDiskSnapshotId, stateAfterStop.provision.output?.dataDiskSnapshotId, "Data disk snapshot ID should match between state and infra")
    })

    it('should start instance with re-provisioning from base image and data disk snapshot', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)
        const infraManager = await getDummyInfraManager()

        await manager.start({ wait: true })
        const detailsAfterStart = await manager.getInstanceStatus()    
        assert.equal(detailsAfterStart.serverStatus, ServerRunningStatus.Running, 'Instance should be running after start')        
        assert.equal(detailsAfterStart.ready, true, 'Instance should be ready after start')

        // Check infrastructure after start
        const stateAfterStart = await getCurrentTestState()
        assert.ok(stateAfterStart.provision.output?.instanceId, "Instance ID should exist after start")
        assert.ok(stateAfterStart.provision.output?.dataDiskId, "Data disk ID should exist after start (restored from snapshot)")
        assert.ok(stateAfterStart.provision.output?.dataDiskSnapshotId, "Data disk snapshot ID should exist after start")
        assert.ok(stateAfterStart.provision.output?.baseImageId, "Base image ID should exist after start")

        const infraAfterStart = await infraManager.getInstanceInfra()
        assert.strictEqual(infraAfterStart?.serverId, stateAfterStart.provision.output?.instanceId, "Server ID should match between state and infra")
        assert.strictEqual(infraAfterStart?.dataDiskId, stateAfterStart.provision.output?.dataDiskId, "Data disk ID should match between state and infra")
        assert.strictEqual(infraAfterStart?.baseImageId, stateAfterStart.provision.output?.baseImageId, "Base image ID should match between state and infra")
        assert.strictEqual(infraAfterStart?.dataDiskSnapshotId, stateAfterStart.provision.output?.dataDiskSnapshotId, "Data disk snapshot ID should match between state and infra")
    })

    it('should restart instance without deleting or re-provisioning', async () => {
        const providerClient = new DummyProviderClient({ config: coreConfig })
        const manager = await providerClient.getInstanceManager(DUMMY_INSTANCE_NAME)
        const infraManager = await getDummyInfraManager()

        const stateBefore = await getCurrentTestState()
        const serverIdBefore = stateBefore.provision.output?.instanceId
        assert.ok(serverIdBefore)

        await manager.restart({ wait: true })
        const detailsAfterRestart = await manager.getInstanceStatus()
        assert.equal(detailsAfterRestart.serverStatus, ServerRunningStatus.Running, 'Instance should be running after restart')
        assert.equal(detailsAfterRestart.ready, true, 'Instance should be ready after restart')

        const stateAfter = await getCurrentTestState()
        assert.strictEqual(stateAfter.provision.output?.instanceId, serverIdBefore, "Instance ID should remain the same after restart")
        const infraAfter = await infraManager.getInstanceInfra()
        assert.strictEqual(infraAfter?.serverId, serverIdBefore, "Server ID should remain the same in infra after restart")
        assert.strictEqual(infraAfter?.serverId, stateAfter.provision.output?.instanceId, "Server ID should match between state and infra after restart")
    })

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
