import * as assert from 'assert';
import { AZURE_SUPPORTED_DISK_TYPES, AzureInstanceInput } from '../../../src/providers/azure/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../utils';
import { AzureCreateCliArgs, AzureInputPrompter } from '../../../src/providers/azure/cli';
import { PartialDeep } from 'type-fest';
import lodash from 'lodash'

describe('Azure input prompter', () => {

    const instanceName = "azure-dummy"

    const TEST_INPUT: AzureInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            subscriptionId: "1234-5689-0000",
            vmSize: "Standard_NC8as_T4_v3",
            diskSize: 200,
            diskType: AZURE_SUPPORTED_DISK_TYPES.STANDARD_LRS,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            location: "francecentral",
            useSpot: true,
            costAlert: {
                notificationEmail: "test@test.com",
                limit: 100
            }
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: AzureCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        yes: true,
        overwriteExisting: false,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        diskSize: TEST_INPUT.provision.diskSize,
        diskType: TEST_INPUT.provision.diskType,
        publicIpType: TEST_INPUT.provision.publicIpType,
        spot: TEST_INPUT.provision.useSpot,
        location: TEST_INPUT.provision.location,
        subscriptionId: TEST_INPUT.provision.subscriptionId,
        vmSize: TEST_INPUT.provision.vmSize,
        costNotificationEmail: TEST_INPUT.provision.costAlert?.notificationEmail,
        costLimit: TEST_INPUT.provision.costAlert?.limit,
    }

    it('should return provided inputs without prompting when full input provider', async () => {
        const result = await new AzureInputPrompter().promptInput(TEST_INPUT, { autoApprove: true })
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new AzureInputPrompter()
        const result = prompter.cliArgsIntoInput(TEST_CLI_ARGS)

        const expected: PartialDeep<AzureInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
    

