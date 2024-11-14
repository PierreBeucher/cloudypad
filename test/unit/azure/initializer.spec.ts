import * as assert from 'assert';
import { CommonInitConfig, InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { InstanceStateV1, StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AzureInitializerPrompt, AzureInstanceInitializer } from '../../../src/providers/azure/initializer';
import { AzureClient } from '../../../src/tools/azure';
import { AzurePulumiClient, AzurePulumiOutput } from '../../../src/tools/pulumi/azure';
import { AzureInstanceRunner } from '../../../src/providers/azure/runner';
import { AzureProvisionConfigV1 } from '../../../src/providers/azure/state';
import { CLOUDYPAD_PROVIDER_AZURE } from '../../../src/core/const';

describe('Azure initializer', () => {

    const provConfig: AzureProvisionConfigV1 = {
        subscriptionId: "1234-5689-0000",
        vmSize: "Standard_NC8as_T4_v3",
        diskSize: 200,
        publicIpType: "static",
        location: "francecentral",
        useSpot: true,
    }
    
    const genericArgs: CommonInitConfig = {
        instanceName: "azure-dummy",
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

    it('should return provided options without prompting for user input', async () => {
        const promt = new AzureInitializerPrompt()
        const result = await promt.prompt(provConfig)
        assert.deepEqual(result, provConfig)
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

        await new AzureInstanceInitializer(genericArgs, provConfig).initializeInstance(opts)

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
                provider: CLOUDYPAD_PROVIDER_AZURE,
                azure: {
                    config: provConfig,
                    output: {
                        resourceGroupName: "dummy-rg",
                        vmName: "dummy-az"
                    }
                }
            },
            version: "1"
        }

        assert.deepEqual(state, expectState)
        
        azureClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

