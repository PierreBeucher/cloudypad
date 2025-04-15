import * as assert from 'assert'
import { StateInitializer } from '../../../../src/core/state/initializer'
import { DEFAULT_COMMON_INPUT } from '../../utils'
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../../src/providers/gcp/state'
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const'
import { StateManagerBuilder } from '../../../../src/core/state/builders'

describe('StateInitializer', function () {

    const TEST_INPUT: GcpInstanceInput = {
        instanceName: "test-init-gcp",
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            machineType: "n1-standard-8",
            diskSize: 200,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "europe-west4",
            zone: "europe-west4-b",
            acceleratorType: "nvidia-tesla-p4",
            projectId: "crafteo-sandbox",
            useSpot: true,
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const EXPECT_STATE: GcpInstanceStateV1 = {
        name: "test-init-gcp",
        version: "1",
        provision: {
            input: TEST_INPUT.provision,
            provider: CLOUDYPAD_PROVIDER_GCP,
            output: undefined
        }, 
        configuration: {
            input: TEST_INPUT.configuration,
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
            output: undefined
        }
    }

    it('should initialize state', async function () {
        const initializer = new StateInitializer({
            input: TEST_INPUT,
            provider: CLOUDYPAD_PROVIDER_GCP,
        })
        const result = await initializer.initializeState()

        assert.deepStrictEqual(result, EXPECT_STATE)

        // try to load state from disk
        const loader = StateManagerBuilder.getInstance().buildStateLoader()
        const loadedState = await loader.loadInstanceState(TEST_INPUT.instanceName)

        // don't compare output as it's "undefined" in memory but actually not set at all on persisted state
        // causing failure with deepStrictEqual
        assert.equal(loadedState.name, EXPECT_STATE.name)
        assert.equal(loadedState.version, EXPECT_STATE.version)
        assert.equal(loadedState.provision.provider, EXPECT_STATE.provision.provider)
        assert.deepStrictEqual(loadedState.provision.input, EXPECT_STATE.provision.input)
        assert.equal(loadedState.configuration.configurator, EXPECT_STATE.configuration.configurator)
        assert.deepStrictEqual(loadedState.configuration.input.sunshine, EXPECT_STATE.configuration.input.sunshine)
    })

})