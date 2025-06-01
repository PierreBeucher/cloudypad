import * as assert from 'assert';
import { createDummyAwsState, DUMMY_AWS_PULUMI_OUTPUT, getUnitTestCoreClient, loadDumyAnonymousStateV1 } from '../utils';
import { InteractiveInstanceUpdater } from '../../../src/cli/updater';
import { AwsUpdateCliArgs, AwsInputPrompter } from '../../../src/providers/aws/cli';
import { AwsInstanceStateV1, AwsStateParser } from '../../../src/providers/aws/state';
import * as lodash from 'lodash'

describe('InteractiveInstanceUpdater', () => {

    it('should update instance with InteractiveInstanceUpdater wihout prompting', async () => {

        // Load known state into dummy writer after changing its name to avoid collision
        const awsState = new AwsStateParser().parse(loadDumyAnonymousStateV1("aws-dummy"))

        const instanceName = "aws-dummy-test-update"
        awsState.name = instanceName

        const coreClient = getUnitTestCoreClient()
        const stateWriter = coreClient.buildStateWriterFor(awsState)
        await stateWriter.persistStateNow()

        const updater = new InteractiveInstanceUpdater<AwsInstanceStateV1, AwsUpdateCliArgs>({
            stateParser: new AwsStateParser(),
            inputPrompter: new AwsInputPrompter({ coreClient: coreClient }),
            coreClient: coreClient
        })

        // Only check that interactive updater does perform a simple update
        // underlying InstanceUpdater is tested in Core and CLI args to Input is tested by provider
        await updater.updateInteractive({
            name: instanceName,
            overwriteExisting: true,
            yes: true,
            diskSize: awsState.provision.input.diskSize + 100,
        })

        // Update should have triggered state update with provisioning + configuration
        const expectedState = {
            ...awsState,
            provision: {
                ...awsState.provision,
                input: {
                    ...awsState.provision.input,
                    diskSize: awsState.provision.input.diskSize + 100,
                },
                output: {
                    ...awsState.provision.output,
                    host: DUMMY_AWS_PULUMI_OUTPUT.publicIp,
                    instanceId: DUMMY_AWS_PULUMI_OUTPUT.instanceId
                }
            },
            configuration: {
                ...awsState.configuration,
                output: {
                    dataDiskConfigured: false
                }
            }
        }

        // Check dummy state after update
        const loader = coreClient.buildStateLoader()
        const updatedState = await loader.loadInstanceState(instanceName)

        assert.strictEqual(updatedState.name, expectedState.name)
        assert.deepStrictEqual(updatedState.configuration, expectedState.configuration)
        assert.deepStrictEqual(updatedState.provision, expectedState.provision)
    })

    // regression test for bug where streaming server was nullified if not provided in CLI args during update
    // instead of reusing existing state value
    it('should not nullify streaming server if not provided in CLI args', async () => {
        // Build dummy state with Sunshine enabled
        const originalState = createDummyAwsState({
            name: "aws-dummy-test-update-no-nullify-sunshine",
            configuration: {
                input: {
                    sunshine: {
                        enable: true,
                        username: "sunshine-user-no-nullify",
                        passwordBase64: Buffer.from("sunshine-password-no-nullify").toString('base64')
                    },
                    wolf: null
                }
            }
        })

        const testState = lodash.cloneDeep(originalState)

        const coreClient = getUnitTestCoreClient()
        const stateWriter = coreClient.buildStateWriterFor(testState)
        await stateWriter.persistStateNow()

        // perform update and check resulting state
        const updater = new InteractiveInstanceUpdater<AwsInstanceStateV1, AwsUpdateCliArgs>({
            stateParser: new AwsStateParser(),
            inputPrompter: new AwsInputPrompter({ coreClient: coreClient }),
            coreClient: coreClient
        })

        // Only check that interactive updater does perform a simple update
        // underlying InstanceUpdater is tested in Core and CLI args to Input is tested by provider
        await updater.updateInteractive({
            name: testState.name,
            overwriteExisting: true,
            yes: true,
            diskSize: testState.provision.input.diskSize + 100,
        })

        const stateLoader = coreClient.buildStateLoader()
        const newState = await stateLoader.loadInstanceState(testState.name)

        assert.deepEqual(newState.configuration.input.sunshine, originalState.configuration.input.sunshine)
        assert.deepEqual(newState.configuration.input.wolf, originalState.configuration.input.wolf)
    })
})


