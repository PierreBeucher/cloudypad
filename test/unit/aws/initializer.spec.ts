import * as assert from 'assert';
import {  AwsInstanceInitializer } from "../../../src/providers/aws/initializer"
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { StateManager } from '../../../src/core/state/manager';
import { AwsInstanceStateV1, AwsProvisionInputV1 } from '../../../src/providers/aws/state';
import { CLOUDYPAD_PROVIDER_AWS, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from "../common/utils";

describe('AwsInstanceInitializer', () => {

    const instanceName = "aws-dummy"

    const input: AwsProvisionInputV1 = {
        ...DEFAULT_COMMON_INPUT,
        instanceType: "g5.2xlarge",
        diskSize: 200,
        publicIpType: PUBLIC_IP_TYPE_STATIC,
        region: "us-west-2",
        useSpot: true,
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new AwsInstanceInitializer({instanceName: instanceName, input: input})

        const result = await awsInitializerPrompt.promptProviderConfig(DEFAULT_COMMON_INPUT)
        assert.deepEqual(result, input)
    })


    it('should initialize instance state with provided arguments', async () => {

        const opts: InstanceInitializationOptions = {
            autoApprove: true,
            overwriteExisting: true
        }

        await new AwsInstanceInitializer({ instanceName: instanceName, input: input}).initializeInstance(opts)

        // Check state has been written
        const state = await StateManager.default().loadInstanceStateSafe(instanceName)

        const expectState: AwsInstanceStateV1 = {
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_AWS,
                input: input,
                output: {
                    host: "127.0.0.1",
                    instanceId: "i-0123456789"
                }
            },
            version: "1"
        }

        assert.deepEqual(state, expectState)
        
    })
})
    

