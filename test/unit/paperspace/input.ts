import * as assert from 'assert';
import { PaperspaceInstanceInput } from '../../../src/providers/paperspace/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';
import { PaperspaceCreateCliArgs, PaperspaceInputPrompter } from '../../../src/providers/paperspace/input';
import { PartialDeep } from 'type-fest';
import lodash from 'lodash'

describe('Paperspace input prompter', () => {

    const instanceName = "paperspace-dummy"

    const TEST_INPUT: PaperspaceInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            apiKey: "xxxSecret",
            machineType: "P5000",
            diskSize: 100,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "East Coast (NY2)",
            ssh: {
                ...DEFAULT_COMMON_INPUT.provision.ssh,
                user: "paperspace"
            }
        },
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: PaperspaceCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        yes: true,
        overwriteExisting: false,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        region: TEST_INPUT.provision.region,
        machineType: TEST_INPUT.provision.machineType,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        apiKeyFile: TEST_INPUT.provision.apiKey,
    }
    
    it('should return provided inputs without prompting when full input provider', async () => {
        const result = await new PaperspaceInputPrompter().promptInput(TEST_INPUT)
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new PaperspaceInputPrompter()
        const result = prompter.cliArgsIntoInput(TEST_CLI_ARGS)

        const expected: PartialDeep<PaperspaceInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
