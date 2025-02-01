import * as assert from 'assert';
import { AwsInstanceInput } from '../../../src/providers/aws/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from "../utils";
import { AwsCreateCliArgs, AwsInputPrompter } from '../../../src/providers/aws/cli';
import lodash from 'lodash'
import { PartialDeep } from 'type-fest';
import { STREAMING_SERVER_SUNSHINE } from '../../../src/core/cli/prompter';

describe('AWS input prompter', () => {

    const instanceName = "aws-dummy"

    const TEST_INPUT: AwsInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            instanceType: "g5.2xlarge",
            diskSize: 200,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "us-west-2",
            useSpot: true,
            costAlert: {
                limit: 999,
                notificationEmail: "dummy@crafteo.io",
            }
        },
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: AwsCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        yes: true,
        overwriteExisting: false,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        instanceType: TEST_INPUT.provision.instanceType,
        region: TEST_INPUT.provision.region,
        spot: TEST_INPUT.provision.useSpot,
        costLimit: TEST_INPUT.provision.costAlert?.limit,
        costNotificationEmail: TEST_INPUT.provision.costAlert?.notificationEmail,
        streamingServer: STREAMING_SERVER_SUNSHINE,
        sunshineUser: TEST_INPUT.configuration.sunshine?.username,
        sunshinePassword: TEST_INPUT.configuration.sunshine?.passwordBase64 ? Buffer.from(TEST_INPUT.configuration.sunshine.passwordBase64, 'base64').toString('utf-8') : undefined,
    }

    it('should return provided inputs without prompting when full input provider', async () => {

        const result = await new AwsInputPrompter().promptInput(TEST_INPUT, { autoApprove: true })
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new AwsInputPrompter()
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<AwsInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user"),
                costAlert: {
                    limit: 999,
                    notificationEmail: "dummy@crafteo.io",
                }
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
    

