import * as assert from 'assert'
import { StateInitializer } from '../../../../src/core/state/initializer'
import { DEFAULT_COMMON_INPUT } from '../../common/utils'
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../../src/providers/gcp/state'
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const'

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
            output: undefined,
            provider: CLOUDYPAD_PROVIDER_GCP
        }, 
        configuration: {
            input: TEST_INPUT.configuration,
            output: undefined,
            configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE
        }
    }

    it('should write on disk state held in memory', async function () {
        const initializer = new StateInitializer({
            input: TEST_INPUT,
            provider: CLOUDYPAD_PROVIDER_GCP,
        })
        const result = await initializer.initializeState()

        assert.deepEqual(result, EXPECT_STATE)
    })



})
