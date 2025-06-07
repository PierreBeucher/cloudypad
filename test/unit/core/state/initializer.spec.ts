import * as assert from 'assert'
import { StateInitializer } from '../../../../src/core/state/initializer'
import { DummyInstanceInput, DummyInstanceStateV1 } from '../../../../src/providers/dummy/state'
import { DummyProviderClient } from '../../../../src/providers/dummy/provider'
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY, PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const'
import { DEFAULT_COMMON_INPUT, getUnitTestCoreConfig } from '../../utils'

describe('StateInitializer', function () {

    const TEST_INPUT: DummyInstanceInput = {
        instanceName: "test-init-dummy",
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            machineType: "dummy-type",
            diskSize: 100,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "dummy-region",
            zone: "dummy-zone",
            acceleratorType: "dummy-accelerator",
            projectId: "dummy-project",
            useSpot: false,
            instanceType: "dummy-instance-type",
            startDelaySeconds: 10,
            stopDelaySeconds: 10
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const EXPECT_STATE: DummyInstanceStateV1 = {
        name: "test-init-dummy",
        version: "1",
        provision: {
            input: TEST_INPUT.provision,
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            output: undefined
        }, 
        configuration: {
            input: TEST_INPUT.configuration,
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
            output: undefined
        },
        events: []
    }

    it('should initialize state', async function () {
        const dummyProviderClient = new DummyProviderClient({ config: getUnitTestCoreConfig() })
        const initializer = new StateInitializer({
            input: TEST_INPUT,
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            stateWriter: dummyProviderClient.getStateWriter(),
            stateParser: dummyProviderClient.getStateParser()
        })
        const result = await initializer.initializeState()

        assert.deepStrictEqual(result, EXPECT_STATE)

        // try to load state from disk
        const loader = dummyProviderClient.getStateLoader()
        const loadedState = await loader.loadInstanceState(TEST_INPUT.instanceName)

        // don't compare output as it's "undefined" in memory but actually not set at all on persisted state
        // causing failure with deepStrictEqual
        assert.equal(loadedState.name, EXPECT_STATE.name)
        assert.equal(loadedState.version, EXPECT_STATE.version)
        assert.equal(loadedState.provision.provider, EXPECT_STATE.provision.provider)
        assert.deepStrictEqual(loadedState.provision.input, EXPECT_STATE.provision.input)
        assert.equal(loadedState.configuration.configurator, EXPECT_STATE.configuration.configurator)
        assert.deepStrictEqual(loadedState.configuration.input.sunshine, EXPECT_STATE.configuration.input.sunshine)
        assert.deepStrictEqual(loadedState.configuration.input.wolf, undefined)
    })

})