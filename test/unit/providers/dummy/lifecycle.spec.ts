import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../../src/cli/initializer';
import { CLOUDYPAD_PROVIDER_DUMMY } from '../../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS, getUnitTestCoreClient } from '../../utils';
import { DummyProvisionInputV1 } from '../../../../src/providers/dummy/state';
import { CommonConfigurationInputV1 } from '../../../../src/core/state/state';
import { InstanceRunningStatus } from '../../../../src/core/runner';

describe('Dummy instance lifecycle', () => {

    const DUMMY_INSTANCE_NAME = "dummy-instance"
    const DUMMY_INSTANCE_TYPE = "dummy-instance-type-1"

    const DUMMY_CLI_ARGS: DummyCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: DUMMY_INSTANCE_NAME,
        instanceType: DUMMY_INSTANCE_TYPE,
        overwriteExisting: true,
        startingTimeSeconds: 0,
        stoppingTimeSeconds: 0
    }

    it('should initialize a new Dummy instance', async () => {

        const coreClient = getUnitTestCoreClient()

        await new InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1>({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            initArgs: DUMMY_CLI_ARGS,
            inputPrompter: new DummyInputPrompter({ coreClient: coreClient }),
            coreClient: coreClient
        }).initializeInteractive({ skipPostInitInfo: true })

        const loader = coreClient.buildStateLoader()
        const state = await loader.loadInstanceState(DUMMY_INSTANCE_NAME)
    })

    it('should provision and configure Dummy instance', async () => {
        const coreClient = getUnitTestCoreClient()
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.provision()
        await manager.configure()
    })

    it('should start, stop, and restart the Dummy instance', async () => {
        const coreClient = getUnitTestCoreClient()
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)

        const detailsBeforeStart = await manager.getInstanceDetails()    
        assert.equal(detailsBeforeStart.status, InstanceRunningStatus.Stopped, 'Instance should be stopped before start')

        await manager.start({ wait: true })
        const detailsAfterStart = await manager.getInstanceDetails()    
        assert.equal(detailsAfterStart.status, InstanceRunningStatus.Running, 'Instance should be running after start')
        
        await manager.stop({ wait: true })
        const detailsAfterStop = await manager.getInstanceDetails()
        assert.equal(detailsAfterStop.status, InstanceRunningStatus.Stopped, 'Instance should be stopped after stop')
        
        await manager.restart({ wait: true })
        const detailsAfterRestart = await manager.getInstanceDetails()
        assert.equal(detailsAfterRestart.status, InstanceRunningStatus.Running, 'Instance should be running after restart')
    }).timeout(20000)

    it('should destroy the Dummy instance', async () => {
        const coreClient = getUnitTestCoreClient()
        const manager = await coreClient.buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.destroy()
    })

})