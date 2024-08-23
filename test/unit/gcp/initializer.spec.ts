import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { GcpInitializerPrompt, GcpInstanceInitializer, GcpProvisionArgs } from '../../../src/providers/gcp/initializer';
import { GcpClient } from '../../../src/tools/gcp';
import { GcpPulumiClient, GcpPulumiOutput } from '../../../src/tools/pulumi/gcp';
import { GcpInstanceRunner } from '../../../src/providers/gcp/runner';

describe('GCP initializer', () => {

    const provArgs: GcpProvisionArgs = {
        create: {
            machineType: "n1-standard-8",
            diskSize: 200,
            publicIpType: "static",
            region: "europe-west4",
            zone: "europe-west4-b",
            acceleratorType: "nvidia-tesla-p4",
            projectId: "crafteo-sandbox",
        },
    }
    
    const genericArgs = {
        instanceName: "gcp-dummy",
        sshKey: "test/resources/ssh-key",
    }

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const promt = new GcpInitializerPrompt();
        const result = await promt.prompt(provArgs);
        assert.deepEqual(result, provArgs)
    })


    it('should initialize instance state with provided arguments', async () => {

        // Stub everything interacting with GCP and VM
        // We just need to check state written on disk and overall process works
        const gcpClientStub = sinon.stub(GcpClient.prototype, 'checkAuth').resolves()
        const dummyPulumiOutput: GcpPulumiOutput = { instanceName: "dummy-gcp", publicIp: "127.0.0.1"}
        const pulumiClientConfigStub = sinon.stub(GcpPulumiClient.prototype, 'setConfig').resolves()
        const pulumiClientUpStub = sinon.stub(GcpPulumiClient.prototype, 'up').resolves(dummyPulumiOutput)
        const pairStub = sinon.stub(GcpInstanceRunner.prototype, 'pair').resolves()
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        await new GcpInstanceInitializer(genericArgs, provArgs).initializeInstance(opts)

        // Check state has been written
        const sm = await StateUtils.loadInstanceState(genericArgs.instanceName)
        const state = sm.get()

        assert.equal(state.host, dummyPulumiOutput.publicIp)
        assert.equal(state.name, genericArgs.instanceName)
        assert.deepEqual(state.provider?.gcp, {
            instanceName: dummyPulumiOutput.instanceName,
            provisionArgs: provArgs
        })
        assert.deepEqual(state.ssh, { user: "ubuntu", privateKeyPath: genericArgs.sshKey})
        assert.equal(state.status.configuration.configured, true)
        assert.equal(state.status.provision.provisioned, true)
        assert.equal(state.status.initalized, true)
        
        gcpClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

