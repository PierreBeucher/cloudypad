import * as assert from 'assert';

import { InteractiveInstanceInitializer } from '../../../src/cli/initializer';
import { CLOUDYPAD_PROVIDER_DUMMY } from '../../../src/core/const';
import { DummyCreateCliArgs, DummyInputPrompter } from '../../../src/providers/dummy/cli';
import { DEFAULT_COMMON_CLI_ARGS } from '../../unit/utils';
import { StateLoader } from '../../../src/core/state/loader';
import { InstanceManagerBuilder } from '../../../src';

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

        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            inputPrompter: new DummyInputPrompter()
        }).initializeInstance(DUMMY_CLI_ARGS, { skipPostInitInfo: true })

        const state = await new StateLoader().loadAndMigrateInstanceState(DUMMY_INSTANCE_NAME)
        
        console.info(JSON.stringify(state, null, 2))
    })

    it('should provision and configure Dummy instance', async () => {
        const manager = await new InstanceManagerBuilder().buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.provision()
        await manager.configure()
    })

    it('should start, stop, and restart the Dummy instance', async () => {
        const manager = await new InstanceManagerBuilder().buildInstanceManager(DUMMY_INSTANCE_NAME)

        await manager.start({ wait: true })
        const detailsAfterStart = await manager.getInstanceDetails()    
        assert.equal(detailsAfterStart.status, 'running', 'Instance should be running after start')
        
        await manager.stop({ wait: true })
        const detailsAfterStop = await manager.getInstanceDetails()
        assert.equal(detailsAfterStop.status, 'stopped', 'Instance should be stopped after stop')
        
        await manager.restart({ wait: true })
        const detailsAfterRestart = await manager.getInstanceDetails()
        assert.equal(detailsAfterRestart.status, 'running', 'Instance should be running after restart')
    })


    it('should destroy the Dummy instance', async () => {
        const manager = await new InstanceManagerBuilder().buildInstanceManager(DUMMY_INSTANCE_NAME)
        await manager.destroy()
    })

})