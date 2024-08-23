import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AzureInitializerPrompt, AzureInstanceInitializer, AzureProvisionArgs } from '../../../src/providers/azure/initializer';
import { AzureClient } from '../../../src/tools/azure';
import { AzurePulumiClient, AzurePulumiOutput } from '../../../src/tools/pulumi/azure';
import { AzureInstanceRunner } from '../../../src/providers/azure/runner';

describe('Azure initializer', () => {

    const provArgs: AzureProvisionArgs = {
        create: {
            subscriptionId: "1234-5689-0000",
            vmSize: "Standard_NC8as_T4_v3",
            diskSize: 200,
            publicIpType: "static",
            location: "francecentral"
        },
    }
    
    const genericArgs = {
        instanceName: "azure-dummy",
        sshKey: "test/resources/ssh-key",
    }

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {
        const promt = new AzureInitializerPrompt()
        const result = await promt.prompt(provArgs)
        assert.deepEqual(result, provArgs)
    })


    it('should initialize instance state with provided arguments', async () => {

        // Stub everything interacting with Azure and VM
        // We just need to check state written on disk and overall process works
        const azureClientStub = sinon.stub(AzureClient, 'checkAuth').resolves()
        const dummyPulumiOutput: AzurePulumiOutput = { vmName: "dummy-az", publicIp: "127.0.0.1", resourceGroupName: "dummy-rg"}
        const pulumiClientConfigStub = sinon.stub(AzurePulumiClient.prototype, 'setConfig').resolves()
        const pulumiClientUpStub = sinon.stub(AzurePulumiClient.prototype, 'up').resolves(dummyPulumiOutput)
        const pairStub = sinon.stub(AzureInstanceRunner.prototype, 'pair').resolves()
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        await new AzureInstanceInitializer(genericArgs, provArgs).initializeInstance(opts)

        // Check state has been written
        const sm = await StateUtils.loadInstanceState(genericArgs.instanceName)
        const state = sm.get()

        assert.equal(state.host, dummyPulumiOutput.publicIp)
        assert.equal(state.name, genericArgs.instanceName)
        assert.deepEqual(state.provider?.azure, {
            vmName: dummyPulumiOutput.vmName,
            resourceGroupName: dummyPulumiOutput.resourceGroupName,
            provisionArgs: provArgs
        })
        assert.deepEqual(state.ssh, { user: "ubuntu", privateKeyPath: genericArgs.sshKey})
        assert.equal(state.status.configuration.configured, true)
        assert.equal(state.status.provision.provisioned, true)
        assert.equal(state.status.initalized, true)
        
        azureClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

