import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../src/cli/initializer';
import { CLOUDYPAD_PROVIDER_DUMMY } from '../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS } from '../../unit/utils';
import { StateLoader } from '../../../src/core/state/loader';
import { InstanceManagerBuilder } from '../../../src';
import { DummyProvisionInputV1 } from '../../../src/providers/dummy/state';
import { CommonConfigurationInputV1 } from '../../../src/core/state/state';

describe('Dummy instance lifecycle', () => {

    const DUMMY_INSTANCE_NAME = "dummy-instance"
    const DUMMY_INSTANCE_TYPE = "dummy-instance-type-1"

    const DUMMY_CLI_ARGS: DummyCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: DUMMY_INSTANCE_NAME,
        instanceType: DUMMY_INSTANCE_TYPE,
        overwriteExisting: true
    }

    it('should initialize a new Dummy instance', async () => {

        await new InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1>({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            initArgs: DUMMY_CLI_ARGS,
            inputPrompter: new DummyInputPrompter()
        }).initializeInteractive({ skipPostInitInfo: true })

        const state = await new StateLoader().loadAndMigrateInstanceState(DUMMY_INSTANCE_NAME)
    })

    it('should provision and configure Dummy instance', async () => {
        const manager = await InstanceManagerBuilder.get().buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.provision()
        await manager.configure()
    })

    it('should start, stop, and restart the Dummy instance', async () => {
        const manager = await InstanceManagerBuilder.get().buildInstanceManager(DUMMY_INSTANCE_NAME)

        await manager.start({ wait: false })
        const detailsAfterStart = await manager.getInstanceDetails()    
        assert.equal(detailsAfterStart.status, 'running', 'Instance should be running after start')
        
        await manager.stop({ wait: false })
        const detailsAfterStop = await manager.getInstanceDetails()
        assert.equal(detailsAfterStop.status, 'stopped', 'Instance should be stopped after stop')
        
        await manager.restart({ wait: false })
        const detailsAfterRestart = await manager.getInstanceDetails()
        assert.equal(detailsAfterRestart.status, 'running', 'Instance should be running after restart')
    }).timeout(20000)

    it('should destroy the Dummy instance', async () => {
        const manager = await InstanceManagerBuilder.get().buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.destroy()
    })

})