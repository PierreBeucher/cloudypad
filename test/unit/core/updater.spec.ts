import * as assert from 'assert';
import {DUMMY_AWS_PULUMI_OUTPUT, loadDumyAnonymousStateV1 } from '../utils';
import { InstanceUpdater } from '../../../src/cli/updater';
import { AwsUpdateCliArgs } from '../../../src/providers/aws/cli';
import { AwsInputPrompter } from '../../../src/providers/aws/cli';
import { AwsInstanceStateV1, AwsStateParser } from '../../../src/providers/aws/state';
import { STREAMING_SERVER_WOLF } from '../../../src/cli/prompter';
import { StateManagerBuilder } from '../../../src/core/state/builders';

describe('InstanceUpdater', () => {

    it('should update instance state with provided arguments', async () => {
        
        // Load known state into dummy writer after changing its name to avoid collision
        const awsState = new AwsStateParser().parse(loadDumyAnonymousStateV1("aws-dummy"))
        const instanceName = "aws-dummy-test-update"
        awsState.name = instanceName

        const stateWriter = StateManagerBuilder.getInstance().buildStateWriter(awsState)
        await stateWriter.persistStateNow()

        const updater = new InstanceUpdater<AwsInstanceStateV1, AwsUpdateCliArgs>({
            stateParser: new AwsStateParser(),
            inputPrompter: new AwsInputPrompter()
        })
        
        await updater.update({
            name: instanceName,
            diskSize: awsState.provision.input.diskSize + 100,
            costAlert: true,
            costLimit: (awsState.provision.input.costAlert?.limit ?? 0) + 100,
            costNotificationEmail: "test@test.com",
            instanceType: "t2.micro",
            yes: true,
            streamingServer: STREAMING_SERVER_WOLF,
            autostop: true,
            autostopTimeout: 600
        })

        // Update should have triggered state update with provisioning + configuration
        const expectedState = {
            ...awsState,
            provision: {
                ...awsState.provision,
                input: {
                    ...awsState.provision.input,
                    diskSize: awsState.provision.input.diskSize + 100,
                    instanceType: "t2.micro",
                    costAlert: {
                        ...awsState.provision.input.costAlert,
                        limit: (awsState.provision.input.costAlert?.limit ?? 0) + 100,
                        notificationEmail: "test@test.com"
                    }
                },
                output: {
                    ...awsState.provision.output,
                    host: DUMMY_AWS_PULUMI_OUTPUT.publicIp,
                    instanceId: DUMMY_AWS_PULUMI_OUTPUT.instanceId
                }
            },
            configuration: {
                ...awsState.configuration,
                input: {
                    sunshine: null,
                    wolf: {
                        enable: true
                    },
                    autostop: {
                        enable: true,
                        timeoutSeconds: 600
                    },
                    locale: null,
                    keyboard: null
                },
                output: {
                    dataDiskConfigured: false
                }
            }
        }

        // Check dummy state after update
        const loader = StateManagerBuilder.getInstance().buildStateLoader()
        const updatedState = await loader.loadInstanceState(instanceName)
        
        assert.deepEqual(updatedState, expectedState)
    })
})
    

