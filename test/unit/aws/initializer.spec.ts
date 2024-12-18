import * as assert from 'assert';
import {  AwsInstanceInitializer } from "../../../src/providers/aws/initializer"
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { StateManager } from '../../../src/core/state/manager';
import { AwsInstanceStateV1, AwsProvisionConfigV1 } from '../../../src/providers/aws/state';
import { CLOUDYPAD_PROVIDER_AWS } from '../../../src/core/const';
import { DEFAULT_COMMON_CONFIG } from "../common/utils";

describe('AwsInstanceInitializer', () => {

    const instanceName = "aws-dummy"

    const config: AwsProvisionConfigV1 = {
        ...DEFAULT_COMMON_CONFIG,
        instanceType: "g5.2xlarge",
        diskSize: 200,
        publicIpType: "static",
        region: "us-west-2",
        useSpot: true,
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new AwsInstanceInitializer({instanceName: instanceName, config: config})

        const result = await awsInitializerPrompt.promptProviderConfig(DEFAULT_COMMON_CONFIG)
        assert.deepEqual(result, config)
    })


    it('should initialize instance state with provided arguments', async () => {

        const opts: InstanceInitializationOptions = {
            autoApprove: true,
            overwriteExisting: true
        }

        await new AwsInstanceInitializer({ instanceName: instanceName, config: config}).initializeInstance(opts)

        // Check state has been written
        const state = await StateManager.default().loadInstanceState(instanceName)

        const expectState: AwsInstanceStateV1 = {
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_AWS,
                config: config,
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
    

