import * as assert from 'assert';
import { PaperspaceInstanceInitializer } from "../../../src/providers/paperspace/initializer"
import { StateManager } from '../../../src/core/state/manager';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { PaperspaceInstanceStateV1, PaperspaceProvisionInputV1 } from '../../../src/providers/paperspace/state';
import { CLOUDYPAD_PROVIDER_PAPERSPACE, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';

describe('PaperspaceInitializerPrompt', () => {

    const conf: PaperspaceProvisionInputV1 = {
        ...DEFAULT_COMMON_INPUT,
        apiKey: "xxxSecret",
        machineType: "P5000",
        diskSize: 100,
        publicIpType: PUBLIC_IP_TYPE_STATIC,
        region: "East Coast (NY2)",
    }

    const instanceName = "paperspace-dummy"
    
    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new PaperspaceInstanceInitializer({ instanceName: instanceName, input: conf})

        const result = await awsInitializerPrompt.promptProviderConfig(DEFAULT_COMMON_INPUT);
        assert.deepEqual(result, conf)
    })

    it('should initialize instance state with provided arguments', async () => {

        await new PaperspaceInstanceInitializer({ instanceName: instanceName, input: conf}).initializeInstance(opts)

        // Check state has been written
        const state = await StateManager.default().loadInstanceStateSafe(instanceName)

        const expectState: PaperspaceInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_PAPERSPACE,
                input: conf,
                output: {
                    host: "127.0.0.1",
                    machineId: "machine-123456788"
                }
            },
        }

        assert.deepEqual(state, expectState)
        
    })
})
