import * as assert from 'assert';
import { createDummyAwsState, createDummyState, DUMMY_AWS_PULUMI_OUTPUT, getUnitTestCoreClient, getUnitTestCoreConfig, getUnitTestDummyProviderClient, initializeDummyInstanceState, loadDumyAnonymousStateV1 } from '../utils';
import { InteractiveInstanceUpdater } from '../../../src/cli/updater';
import { AwsUpdateCliArgs } from '../../../src/providers/aws/cli';
import * as lodash from 'lodash'
import { DummyStateParser, DummyInstanceStateV1 } from '../../../src/providers/dummy/state';
import { DummyInputPrompter, DummyUpdateCliArgs } from '../../../src/providers/dummy/cli';
import { DummyProvisionInputV1 } from '../../../src/providers/dummy/state';

describe('InteractiveInstanceUpdater', () => {

    const dummyProviderClient = getUnitTestDummyProviderClient()
    const coreConfig = getUnitTestCoreConfig()

    it('should update instance with InteractiveInstanceUpdater wihout prompting', async () => {

        // Load known state into dummy writer after changing its name to avoid collision
        const dummyState = await initializeDummyInstanceState("cli-updater-test")
        const manager = await dummyProviderClient.getInstanceManager(dummyState.name)
        await manager.deploy()

        const updater = new InteractiveInstanceUpdater<DummyInstanceStateV1, DummyUpdateCliArgs>({
            inputPrompter: new DummyInputPrompter({ coreConfig: coreConfig }),
            providerClient: dummyProviderClient
        })

        // Only check that interactive updater does perform a simple update
        // underlying InstanceUpdater is tested in Core and CLI args to Input is tested by provider
        await updater.updateInteractive({
            name: dummyState.name,
            overwriteExisting: true,
            yes: true,
            ansibleAdditionalArgs: "--updated-args"
        })

        // Update should have triggered state update with provisioning + configuration
        const expectedState: DummyInstanceStateV1 = {
            ...dummyState,
            provision: {
                ...dummyState.provision,
                input: {
                    ...dummyState.provision.input,
                },
            },
            configuration: {
                ...dummyState.configuration,
                input: {
                    ...dummyState.configuration.input,
                    ansible: {
                        additionalArgs: "--updated-args"
                    },
                }
            }
        }

        // wolf value is undefined but is actually missing from result
        // but deepStrictEqual treat undefined != missing
        // that's what we want since serializing undefined value into JSON produces no value at all
        delete expectedState.configuration.input.wolf

        // Check dummy state after update
        const loader = dummyProviderClient.getStateLoader()
        const updatedState = await loader.loadInstanceState(dummyState.name)

        assert.strictEqual(updatedState.name, expectedState.name)
        assert.deepStrictEqual(updatedState.configuration.input, expectedState.configuration.input)
        assert.deepStrictEqual(updatedState.provision.input, expectedState.provision.input)
    })

    // regression test for bug where streaming server was nullified if not provided in CLI args during update
    // instead of reusing existing state value
    it('should not nullify streaming server if not provided in CLI args', async () => {
        // Build dummy state with Sunshine enabled
        const originalState = createDummyState({
            name: "dummy-provider-test-update-no-nullify-sunshine",
            configuration: {
                input: {
                    sunshine: {
                        enable: true,
                        username: "sunshine-user-no-nullify",
                        passwordBase64: Buffer.from("sunshine-password-no-nullify").toString('base64')
                    },
                    wolf: null,
                }
            },
            provision: {
                input: {
                    
                }
            }
        })

        const testState = lodash.cloneDeep(originalState)

        const stateWriter = dummyProviderClient.getStateWriter()
        await stateWriter.setState(testState)

        // initial deploy to setup outputs
        const manager = await dummyProviderClient.getInstanceManager(testState.name)
        await manager.deploy()

        // perform update and check resulting state
        const updater = new InteractiveInstanceUpdater<DummyInstanceStateV1, AwsUpdateCliArgs>({
            inputPrompter: new DummyInputPrompter({ coreConfig: coreConfig }),
            providerClient: dummyProviderClient
        })

        await updater.updateInteractive({
            name: testState.name,
            overwriteExisting: true,
            yes: true,
            diskSize: 500
        })

        const stateLoader = dummyProviderClient.getStateLoader()
        const newState = await stateLoader.loadInstanceState(testState.name)

        // check sunshine has not been nullified and both streaming servers match original state
        assert.deepEqual(newState.configuration.input.sunshine, originalState.configuration.input.sunshine)
        assert.deepEqual(newState.configuration.input.wolf, originalState.configuration.input.wolf)
    }).timeout(10000)
})


