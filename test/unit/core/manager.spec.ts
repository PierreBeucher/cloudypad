import * as assert from 'assert';
import { DEFAULT_COMMON_INPUT, getUnitTestCoreConfig, getUnitTestDummyProviderClient, initializeDummyInstanceState } from '../utils';
import { InstanceEventEnum, STATE_MAX_EVENTS } from '../../../src/core/state/state';
import { InstanceStatus, InstanceManager } from '../../../src/core/manager';
import { ServerRunningStatus } from '../../../src/core/runner';
import { getLogger } from '../../../src/log/utils';
import { CloudypadClient } from '../../../src/core/client';
import * as sinon from 'sinon';

describe('Instance manager', () => {

    const logger = getLogger("InstanceManager test")
    const coreConfig = getUnitTestCoreConfig()

    it('should be able to start, stop and restart an instance with expected status at every step', async () => {
        const instanceName = "dummy-test-core-manager"
        
        const dummyProviderClient = getUnitTestDummyProviderClient()
        const initiliazer = dummyProviderClient.getInstanceInitializer()
        

        //
        // Init
        // 
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

        const manager = await dummyProviderClient.getInstanceManager(instanceName)

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

        const eventsBeforeProvision = await manager.getEvents()
        assert.strictEqual(eventsBeforeProvision.length, 1)
        assert.strictEqual(eventsBeforeProvision[0].type, InstanceEventEnum.Init)

        //
        // provision
        //
        await manager.provision()

        const actualStatusAfterProvision = await manager.getInstanceStatus()
        const expectedStatusAfterProvision: InstanceStatus = {
            provisioned: true,
            configured: false,
            serverStatus: ServerRunningStatus.Running,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterProvision, expectedStatusAfterProvision)

        const eventsAfterProvision = await manager.getEvents()
        assert.strictEqual(eventsAfterProvision.length, 3)
        assert.strictEqual(eventsAfterProvision[1].type, InstanceEventEnum.ProvisionBegin)
        assert.strictEqual(eventsAfterProvision[2].type, InstanceEventEnum.ProvisionEnd)
        
        const latestEventAfterProvision = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterProvision?.type, InstanceEventEnum.ProvisionEnd)

        //
        // configure
        //
        await manager.configure()
        const actualStatusAfterConfigure = await manager.getInstanceStatus()
        const expectedStatusAfterConfigure: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterConfigure, expectedStatusAfterConfigure)

        const eventsAfterConfigure = await manager.getEvents()
        assert.strictEqual(eventsAfterConfigure.length, 5)
        assert.strictEqual(eventsAfterConfigure[3].type, InstanceEventEnum.ConfigurationBegin)
        assert.strictEqual(eventsAfterConfigure[4].type, InstanceEventEnum.ConfigurationEnd)

        const latestEventAfterConfigure = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterConfigure?.type, InstanceEventEnum.ConfigurationEnd)


        //
        // stop
        //
        await manager.stop()
        const actualStatusAfterStop = await manager.getInstanceStatus()
        const expectedStatusAfterStop: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Stopped,
            ready: false
        }
        assert.deepStrictEqual(actualStatusAfterStop, expectedStatusAfterStop)

        const eventsAfterStop = await manager.getEvents()

        logger.debug(`Events after stop: ${JSON.stringify(eventsAfterStop)}`)

        assert.strictEqual(eventsAfterStop.length, 7)
        assert.strictEqual(eventsAfterStop[5].type, InstanceEventEnum.StopBegin)
        assert.strictEqual(eventsAfterStop[6].type, InstanceEventEnum.StopEnd)

        const latestEventAfterStop = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterStop?.type, InstanceEventEnum.StopEnd)

        //
        // start
        //
        await manager.start()
        const actualStatusAfterStart = await manager.getInstanceStatus()
        const expectedStatusAfterStart: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterStart, expectedStatusAfterStart)

        const eventsAfterStart = await manager.getEvents()
        assert.strictEqual(eventsAfterStart.length, 9)
        assert.strictEqual(eventsAfterStart[7].type, InstanceEventEnum.StartBegin)
        assert.strictEqual(eventsAfterStart[8].type, InstanceEventEnum.StartEnd)

        const latestEventAfterStart = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterStart?.type, InstanceEventEnum.StartEnd)

        //
        // restart
        //
        await manager.restart()
        const actualStatusAfterRestart = await manager.getInstanceStatus()
        const expectedStatusAfterRestart: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterRestart, expectedStatusAfterRestart)

        const eventsAfterRestart = await manager.getEvents()

        logger.debug(`Events after restart: ${JSON.stringify(eventsAfterRestart)}`)
        assert.strictEqual(eventsAfterRestart.length, STATE_MAX_EVENTS)
        assert.strictEqual(eventsAfterRestart[0].type, InstanceEventEnum.ProvisionBegin)
        assert.strictEqual(eventsAfterRestart[8].type, InstanceEventEnum.RestartBegin)
        assert.strictEqual(eventsAfterRestart[9].type, InstanceEventEnum.RestartEnd)

        const latestEventAfterRestart = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterRestart?.type, InstanceEventEnum.RestartEnd)

        //
        // deploy
        //
        await manager.deploy()
        const actualStatusAfterDeploy = await manager.getInstanceStatus()
        const expectedStatusAfterDeploy: InstanceStatus = {
            provisioned: true,
            configured: true,
            serverStatus: ServerRunningStatus.Running,
            ready: true
        }
        assert.deepStrictEqual(actualStatusAfterDeploy, expectedStatusAfterDeploy)

        const eventsAfterDeploy = await manager.getEvents()
        assert.strictEqual(eventsAfterDeploy.length, STATE_MAX_EVENTS)
        assert.strictEqual(eventsAfterDeploy[0].type, InstanceEventEnum.StopBegin)
        assert.strictEqual(eventsAfterDeploy[6].type, InstanceEventEnum.ProvisionBegin)
        assert.strictEqual(eventsAfterDeploy[7].type, InstanceEventEnum.ProvisionEnd)
        assert.strictEqual(eventsAfterDeploy[8].type, InstanceEventEnum.ConfigurationBegin)
        assert.strictEqual(eventsAfterDeploy[9].type, InstanceEventEnum.ConfigurationEnd)
        
        const latestEventAfterDeploy = await manager.getLatestEvent()
        assert.strictEqual(latestEventAfterDeploy?.type, InstanceEventEnum.ConfigurationEnd)

        //
        // destroy
        //
        await manager.destroy()
        
        const cloudypadClient = new CloudypadClient({ config: coreConfig })
        const instanceExists = await cloudypadClient.instanceExists(instanceName)
        assert.strictEqual(instanceExists, false)
   })


    it(`should not retry action when it succeeds`, async () => {
        const instanceName = `dummy-test-core-manager-action-no-retry`
        await initializeDummyInstanceState(instanceName)
        const dummyProviderClient = getUnitTestDummyProviderClient()
        const manager = await dummyProviderClient.getInstanceManager(instanceName)

        const retryArgs = { retries: 3, retryDelaySeconds: 0 }
        const actionsToTest: { action: () => Promise<void>, stubName: keyof InstanceManager }[] = [
            { action: async() => { return manager.configure(retryArgs) }, stubName: 'doConfigure' },
            { action: async() => { return manager.provision(retryArgs) }, stubName: 'doProvision' },
            { action: async() => { return manager.start(retryArgs) }, stubName: 'doStart' },
            { action: async() => { return manager.stop(retryArgs) }, stubName: 'doStop' },
            { action: async() => { return manager.restart(retryArgs) }, stubName: 'doRestart' },
            { action: async() => { return manager.destroy(retryArgs) }, stubName: 'doDestroy' },
        ]

        for (const action of actionsToTest) {
            // stub doAction function to succeed immediately, should not retry
            const stubFn = sinon.stub(manager, action.stubName)
            stubFn.resolves()

            await action.action()
            assert.strictEqual(stubFn.callCount, 1)
        }
    })

    it(`should retry action when it fails`, async () => {
        const instanceName = `dummy-test-core-manager-action-retry`
        await initializeDummyInstanceState(instanceName)
        const dummyProviderClient = getUnitTestDummyProviderClient()
        const manager = await dummyProviderClient.getInstanceManager(instanceName)

        const retryArgs = { retries: 3, retryDelaySeconds: 0 }
        const actionsToTest: { action: () => Promise<void>, stubName: keyof InstanceManager }[] = [
            { action: async() => { return manager.configure(retryArgs) }, stubName: 'doConfigure' },
            { action: async() => { return manager.provision(retryArgs) }, stubName: 'doProvision' },
            { action: async() => { return manager.start(retryArgs) }, stubName: 'doStart' },
            { action: async() => { return manager.stop(retryArgs) }, stubName: 'doStop' },
            { action: async() => { return manager.restart(retryArgs) }, stubName: 'doRestart' },
            { action: async() => { return manager.destroy(retryArgs) }, stubName: 'doDestroy' },
        ]

        for (const action of actionsToTest) {
            // stub doAction function to fail, should retry
            const stubFn = sinon.stub(manager, action.stubName)
            stubFn.onFirstCall().rejects(new Error('First failure'))
            stubFn.onSecondCall().rejects(new Error('Second failure'))
            stubFn.onThirdCall().resolves()

            await action.action()
            assert.strictEqual(stubFn.callCount, 3)
        }
    })
})