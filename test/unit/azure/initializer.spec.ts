import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { AzureInstanceInitializer } from '../../../src/providers/azure/initializer';
import { AzureClient } from '../../../src/tools/azure';
import { AzurePulumiClient, AzurePulumiOutput } from '../../../src/tools/pulumi/azure';
import { AzureInstanceRunner } from '../../../src/providers/azure/runner';
import { AzureInstanceStateV1, AzureProvisionConfigV1 } from '../../../src/providers/azure/state';
import { CLOUDYPAD_PROVIDER_AZURE } from '../../../src/core/const';
import { DEFAULT_COMMON_CONFIG } from '../common/utils';

describe('Azure initializer', () => {

    const config: AzureProvisionConfigV1 = {
        ...DEFAULT_COMMON_CONFIG,
        subscriptionId: "1234-5689-0000",
        vmSize: "Standard_NC8as_T4_v3",
        diskSize: 200,
        publicIpType: "static",
        location: "francecentral",
        useSpot: true,
    }

    const instanceName = "azure-dummy"

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {
        const promt = new AzureInstanceInitializer({ instanceName: instanceName, config: config })
        const result = await promt.promptProviderConfig(DEFAULT_COMMON_CONFIG)
        assert.deepEqual(result, config)
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

        await new AzureInstanceInitializer({ instanceName: instanceName, config: config }).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(instanceName)

        const expectState: AzureInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_AZURE,
                config: config,
                output: {
                    host: "127.0.0.1",
                    resourceGroupName: "dummy-rg",
                    vmName: "dummy-az"
                }
            },
        }

        assert.deepEqual(state, expectState)
        
        azureClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

