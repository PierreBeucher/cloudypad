import * as assert from 'assert';
import { PaperspaceInstanceInitializer } from "../../../src/providers/paperspace/initializer"
import { StateUtils } from '../../../src/core/state';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { PaperspaceInstanceStateV1, PaperspaceProvisionConfigV1 } from '../../../src/providers/paperspace/state';
import { CLOUDYPAD_PROVIDER_PAPERSPACE } from '../../../src/core/const';
import { DEFAULT_COMMON_CONFIG } from '../common/utils';

describe('PaperspaceInitializerPrompt', () => {

    const conf: PaperspaceProvisionConfigV1 = {
        ...DEFAULT_COMMON_CONFIG,
        apiKey: "xxxSecret",
        machineType: "P5000",
        diskSize: 100,
        publicIpType: "static",
        region: "East Coast (NY2)",
    }

    const instanceName = "paperspace-dummy"
    
    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new PaperspaceInstanceInitializer({ instanceName: instanceName, config: conf})

        const result = await awsInitializerPrompt.promptProviderConfig(DEFAULT_COMMON_CONFIG);
        assert.deepEqual(result, conf)
    })

    it('should initialize instance state with provided arguments', async () => {

        await new PaperspaceInstanceInitializer({ instanceName: instanceName, config: conf}).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(instanceName)

        const expectState: PaperspaceInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_PAPERSPACE,
                config: conf,
                output: {
                    host: "127.0.0.1",
                    machineId: "machine-123456788"
                }
            },
        }

        assert.deepEqual(state, expectState)
        
    })
})
