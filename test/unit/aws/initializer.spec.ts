import * as assert from 'assert';
import { AwsInitializerPrompt, AwsInstanceInitializer } from "../../../src/providers/aws/initializer"
import { CommonInitConfig, InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { AwsInstanceRunner } from '../../../src/providers/aws/runner';
import { AwsPulumiClient, AwsPulumiOutput } from '../../../src/tools/pulumi/aws';
import { InstanceStateV1, StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AwsClient } from '../../../src/tools/aws';
import { AwsProvisionConfigV1 } from '../../../src/providers/aws/state';
import { CLOUDYPAD_PROVIDER_AWS } from '../../../src/core/const';

describe('AwsInitializerPrompt', () => {

    const provConfig: AwsProvisionConfigV1 = {
        instanceType: "g5.2xlarge",
        diskSize: 200,
        publicIpType: "static",
        region: "us-west-2",
        useSpot: true,
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new AwsInitializerPrompt()

        const result = await awsInitializerPrompt.prompt(provConfig)
        assert.deepEqual(result, provConfig)
    })


    it('should initialize instance state with provided arguments', async () => {

        const genericArgs: CommonInitConfig = {
            instanceName: "aws-dummy",
            provisionConfig: {
                ssh: {
                    privateKeyPath: "./test/resources/ssh-key",
                    user: "ubuntu"
                }
            }
        }

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

        await new AwsInstanceInitializer(genericArgs, provConfig).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(genericArgs.instanceName)

        const expectState: InstanceStateV1 = {
            name: genericArgs.instanceName,
            provision: {
                common: {
                    config: genericArgs.provisionConfig,
                    output: {
                        host: "127.0.0.1"
                    }
                },
                provider: CLOUDYPAD_PROVIDER_AWS,
                aws: {
                    config: provConfig,
                    output: {
                        instanceId: "i-0123456789"
                    }
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
    

