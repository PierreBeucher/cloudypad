import * as assert from 'assert';
import { SshCreateCliArgs, SshInputPrompter } from '../../../../src/providers/ssh/cli';
import { DEFAULT_COMMON_CLI_ARGS, DEFAULT_COMMON_INPUT, getUnitTestCoreClient, getUnitTestCoreConfig } from '../../utils';
import { PartialDeep } from 'type-fest';
import lodash from 'lodash';
import { SshInstanceInput } from '../../../../src/providers/ssh/state';

describe('SSH input prompter', () => {

    const instanceName = "ssh-dummy"
    const coreConfig = getUnitTestCoreConfig()

    const TEST_INPUT: SshInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            hostname: "192.168.1.100",
            ssh: {
                user: "ubuntu",
                // privateKeyPath: undefined,
                // privateKeyContentBase64: undefined,
                passwordBase64: Buffer.from("password").toString('base64')
            }
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: SshCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: instanceName,
        hostname: TEST_INPUT.provision.hostname,
        sshPrivateKey: undefined,
        sshUser: TEST_INPUT.provision.ssh.user,
        sshPassword: "password"
    }

    // it('should return provided inputs without prompting when full input provider', async () => {
    //     const coreClient = getUnitTestCoreClient()
    //     const result = await new SshInputPrompter({ coreConfig: coreConfig }).promptInput(TEST_INPUT, { autoApprove: true })
    //     assert.deepEqual(result, TEST_INPUT)
    // })

    it('should convert CLI args into partial input', () => {
        const prompter = new SshInputPrompter({ coreConfig: coreConfig })
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<SshInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: {
                    user: "ubuntu",
                    privateKeyPath: undefined,
                    passwordBase64: Buffer.from("password").toString('base64')
                },
            },
            configuration: {
                ...TEST_INPUT.configuration,
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
