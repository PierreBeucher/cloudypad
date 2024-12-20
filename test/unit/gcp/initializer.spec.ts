import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { StateManager } from '../../../src/core/state/manager';
import { GcpInstanceInitializer } from '../../../src/providers/gcp/initializer';
import { GcpInstanceStateV1, GcpProvisionInputV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';

describe('GCP initializer', () => {

    const conf: GcpProvisionInputV1 = {
        ...DEFAULT_COMMON_INPUT,
        machineType: "n1-standard-8",
        diskSize: 200,
        publicIpType: PUBLIC_IP_TYPE_STATIC,
        region: "europe-west4",
        zone: "europe-west4-b",
        acceleratorType: "nvidia-tesla-p4",
        projectId: "crafteo-sandbox",
        useSpot: true,
    }
    
    const instanceName = "gcp-dummy"
    
    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const promt = new GcpInstanceInitializer({ instanceName: instanceName, input: conf})
        const result = await promt.promptProviderConfig(DEFAULT_COMMON_INPUT)
        assert.deepEqual(result, conf)
    })


    it('should initialize instance state with provided arguments', async () => {

        await new GcpInstanceInitializer({ instanceName: instanceName, input: conf}).initializeInstance(opts)

        // Check state has been written
        const state = await StateManager.default().loadInstanceStateSafe(instanceName)

        const expectState: GcpInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_GCP,
                input: conf,
                output: {
                    host: "127.0.0.1",
                    instanceName: "dummy-gcp"
                }
            },
        }
        
        assert.deepEqual(state, expectState)
    })
})
    

