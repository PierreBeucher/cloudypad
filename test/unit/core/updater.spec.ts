import * as assert from 'assert';
import { DUMMY_AWS_PULUMI_OUTPUT, DUMMY_SSH_KEY_PATH, loadState } from '../utils';
import { StateLoader } from '../../../src/core/state/loader';
import { InstanceUpdater } from '../../../src/core/updater';
import { InstanceStateV1 } from '../../../src/core/state/state';
import { StateWriter } from '../../../src/core/state/writer';
import lodash from 'lodash'

describe('InstanceUpdater', () => {

    
    
    it('should update instance state with provided arguments', async () => {
        
        // Load known state into dummy writer after changing its name to avoid collision
        const state = loadState("aws-dummy")
        const instanceName = "aws-dummy-test-update"
        state.name = instanceName
        
        const stateWriter = new StateWriter({
            state: state
        })

        const updater = new InstanceUpdater<InstanceStateV1>({
            stateWriter: stateWriter
        })

        await updater.update({
            provisionInput: {
                ssh: {
                    privateKeyPath: DUMMY_SSH_KEY_PATH,
                    user: "foo"
                }
            },
            configurationInput: {}
        }, {
            autoApprove: true
        })

        // Update should have triggered state update with provisioning + configuration
        const expectedState = lodash.merge({},
            state,
            {
                provision: {
                    input: {
                        ssh: {
                            privateKeyPath: DUMMY_SSH_KEY_PATH,
                            user: "foo",
                        }
                    },
                    output: {
                        host: DUMMY_AWS_PULUMI_OUTPUT.publicIp,
                        instanceId: DUMMY_AWS_PULUMI_OUTPUT.instanceId
                    }
                }, 
                configuration: {
                    output: {}
                }
            }
        )

        // Check dummy state after update
        const loader = new StateLoader()
        const updatedState = await loader.loadInstanceStateSafe(instanceName)
        
        assert.deepEqual(expectedState, updatedState)
    })
})
    

