import * as assert from 'assert';
import {  AwsInstanceInitializer } from "../../../src/providers/aws/initializer"
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { AwsInstanceRunner } from '../../../src/providers/aws/runner';
import { AwsPulumiClient, AwsPulumiOutput } from '../../../src/tools/pulumi/aws';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AwsClient } from '../../../src/tools/aws';
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

        // Stub everything interacting with AWS and VM
        // We just need to check state written on disk and overall process works
        const awsClientStub = sinon.stub(AwsClient.prototype, 'checkAuth').resolves()
        const dummyPulumiOutput: AwsPulumiOutput = { instanceId: "i-0123456789", publicIp: "127.0.0.1"}
        const pulumiClientConfigStub = sinon.stub(AwsPulumiClient.prototype, 'setConfig').resolves()
        const pulumiClientUpStub = sinon.stub(AwsPulumiClient.prototype, 'up').resolves(dummyPulumiOutput)
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()
        const pairStub = sinon.stub(AwsInstanceRunner.prototype, 'pair').resolves()

        await new AwsInstanceInitializer({ instanceName: instanceName, config: config}).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(instanceName)

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
        
        awsClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

