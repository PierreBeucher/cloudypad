import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { StateManager } from '../../../src/core/state/manager';
import { AzureInstanceInitializer } from '../../../src/providers/azure/initializer';
import { AzureInstanceStateV1, AzureProvisionInputV1 } from '../../../src/providers/azure/state';
import { CLOUDYPAD_PROVIDER_AZURE, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';

describe('Azure initializer', () => {

    const input: AzureProvisionInputV1 = {
        ...DEFAULT_COMMON_INPUT,
        subscriptionId: "1234-5689-0000",
        vmSize: "Standard_NC8as_T4_v3",
        diskSize: 200,
        publicIpType: PUBLIC_IP_TYPE_STATIC,
        location: "francecentral",
        useSpot: true,
    }

    const instanceName = "azure-dummy"

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {
        const promt = new AzureInstanceInitializer({ instanceName: instanceName, input: input })
        const result = await promt.promptProviderConfig(DEFAULT_COMMON_INPUT)
        assert.deepEqual(result, input)
    })


    it('should initialize instance state with provided arguments', async () => {

        await new AzureInstanceInitializer({ instanceName: instanceName, input: input }).initializeInstance(opts)

        // Check state has been written
        const state = await StateManager.default().loadInstanceStateSafe(instanceName)

        const expectState: AzureInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_AZURE,
                input: input,
                output: {
                    host: "127.0.0.1",
                    resourceGroupName: "dummy-rg",
                    vmName: "dummy-az"
                }
            },
        }

        assert.deepEqual(state, expectState)
    })
})
    

