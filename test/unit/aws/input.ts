import * as assert from 'assert';
import { AwsInstanceInput } from '../../../src/providers/aws/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from "../common/utils";
import { AwsCreateCliArgs, AwsInputPrompter } from '../../../src/providers/aws/input';
import lodash from 'lodash'
import { PartialDeep } from 'type-fest';

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
        },
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: AwsCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        autoApprove: true,
        overwriteExisting: false,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        instanceType: TEST_INPUT.provision.instanceType,
        region: TEST_INPUT.provision.region,
        spot: TEST_INPUT.provision.useSpot,
    }

    it('should return provided inputs without prompting when full input provider', async () => {

        const result = await new AwsInputPrompter().promptInput(TEST_INPUT)
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new AwsInputPrompter()
        const result = prompter.cliArgsIntoInput(TEST_CLI_ARGS)

        const expected: PartialDeep<AwsInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
    

