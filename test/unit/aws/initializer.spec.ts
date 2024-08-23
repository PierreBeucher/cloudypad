import * as assert from 'assert';
import { AwsInitializerPrompt, AwsInstanceInitializer, AwsProvisionArgs } from "../../../src/providers/aws/initializer"
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { AwsInstanceRunner } from '../../../src/providers/aws/runner';
import { AwsPulumiClient, AwsPulumiOutput } from '../../../src/tools/pulumi/aws';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AwsClient } from '../../../src/tools/aws';

describe('AwsInitializerPrompt', () => {

    const provArgs: AwsProvisionArgs = {
        create: {
            instanceType: "g5.2xlarge",
            diskSize: 200,
            publicIpType: "static",
            region: "us-west-2"
        },
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new AwsInitializerPrompt();

        const result = await awsInitializerPrompt.prompt(provArgs);
        assert.deepEqual(result, provArgs)
    })


    it('should initialize instance state with provided arguments', async () => {

        const genericArgs = {
            instanceName: "aws-dummy",
            sshKey: "test/resources/ssh-key",
        }

        const opts: InstanceInitializationOptions = {
            autoApprove: true,
            overwriteExisting: true
        }

        // Stub everything interacting with AWS and VM
        // We just need to check state written on disk and overall process works
        const awsClientStub = sinon.stub(AwsClient.prototype, 'checkAuth').resolves();
        const dummyPulumiOutput: AwsPulumiOutput = { instanceId: "i-0123456789", publicIp: "127.0.0.1"}
        const pulumiClientConfigStub = sinon.stub(AwsPulumiClient.prototype, 'setConfig').resolves()
        const pulumiClientUpStub = sinon.stub(AwsPulumiClient.prototype, 'up').resolves(dummyPulumiOutput)
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()
        const pairStub = sinon.stub(AwsInstanceRunner.prototype, 'pair').resolves()

        await new AwsInstanceInitializer(genericArgs, provArgs).initializeInstance(opts)

        // Check state has been written
        const sm = await StateUtils.loadInstanceState(genericArgs.instanceName)
        const state = sm.get()

        assert.equal(state.host, dummyPulumiOutput.publicIp)
        assert.equal(state.name, genericArgs.instanceName)
        assert.deepEqual(state.provider?.aws, {
            instanceId: dummyPulumiOutput.instanceId,
            provisionArgs: provArgs
        })
        assert.deepEqual(state.ssh, { user: "ubuntu", privateKeyPath: genericArgs.sshKey})
        assert.equal(state.status.configuration.configured, true)
        assert.equal(state.status.provision.provisioned, true)
        assert.equal(state.status.initalized, true)
        
        awsClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

