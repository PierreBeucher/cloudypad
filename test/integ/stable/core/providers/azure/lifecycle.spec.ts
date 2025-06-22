import * as assert from 'assert';
import { AzureClient, AzureVmStatus } from '../../../../../../src/providers/azure/sdk-client';
import { AzureInstanceStateV1 } from '../../../../../../src/providers/azure/state';
import { getIntegTestCoreConfig } from '../../../../utils';
import { AzureProviderClient } from '../../../../../../src/providers/azure/provider';
import { ServerRunningStatus } from '../../../../../../src/core/runner';
import { getLogger } from '../../../../../../src/log/utils';
import { CloudypadClient } from '../../../../../../src/core/client';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../../../src/core/const';

describe('Azure lifecycle', () => {
    const logger = getLogger("test-azure-lifecycle");
    const coreConfig = getIntegTestCoreConfig();
    const azureProviderClient = new AzureProviderClient({ config: coreConfig });
    const instanceName = 'test-instance-azure-lifecycle';

    const location = "francecentral";
    const vmSize = "Standard_NC8as_T4_v3";

    let currentVmName: string | undefined = undefined;
    let currentResourceGroupName: string | undefined = undefined;

    async function getCurrentTestState(): Promise<AzureInstanceStateV1> {
        return azureProviderClient.getInstanceState(instanceName);
    }

    async function getAzureClient(): Promise<AzureClient> {
        const state = await getCurrentTestState();
        return new AzureClient(instanceName, state.provision.input.subscriptionId);
    }

    async function waitForInstanceReadiness(scenario: string): Promise<void> {
        const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
        
        let isReady = false;
        for (let attempt = 0; attempt < 60; attempt++) {
            isReady = await instanceManager.isReady();
            if (isReady) break;
            logger.info(`Waiting for instance readiness after ${scenario}... ${attempt + 1} / 60`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 5 seconds before retrying
        }
        assert.strictEqual(isReady, true);
    }
    
    it('should initialize instance state', async () => {
        assert.strictEqual(currentVmName, undefined);

        const initializer = new AzureProviderClient({config: coreConfig}).getInstanceInitializer();
        await initializer.initializeStateOnly(instanceName, {
            ssh: {
                user: "ubuntu",
            },
            vmSize: vmSize,
            diskSize: 100,
            diskType: "Standard_LRS",
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            subscriptionId: "0dceb5ed-9096-4db7-b430-2609e7cc6a15",
            location: location,
            useSpot: false,
            costAlert: {
                limit: 2,
                notificationEmail: "test@test.com"
            }
        }, {
            wolf: {
                enable: true
            }, 
        });
    })

    it('should deploy instance', async () => {
        const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const azureClient = await getAzureClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.vmName);
        assert.ok(state.provision.output?.resourceGroupName);
        currentVmName = state.provision.output.vmName;
        currentResourceGroupName = state.provision.output.resourceGroupName;

        const instances = await azureClient.listInstances();
        const instance = instances.find(instance => instance.name === currentVmName);
        assert.ok(instance);
        assert.strictEqual(instance.hardwareProfile?.vmSize, vmSize);
    }).timeout(20*60*1000); // 20 minutes timeout as deployment may be long

    // Seems to be stuck - missing await ?
    it('should update instance', async () => {
        const instanceUpdater = azureProviderClient.getInstanceUpdater();
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            provisionInputs: {
                vmSize: "Standard_NC4as_T4_v3",
            }, 
        });

        const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const azureClient = await getAzureClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.vmName);
        currentVmName = state.provision.output.vmName;

        const instances = await azureClient.listInstances();
        const instance = instances.find(instance => instance.name === currentVmName);
        assert.ok(instance);
        assert.strictEqual(instance.hardwareProfile?.vmSize, "Standard_NC4as_T4_v3");

    }).timeout(15*60*1000);


    it('should have a valid instance server output with existing server', async () => {
        const state = await getCurrentTestState();
        
        assert.ok(state.provision.output?.vmName);
        assert.ok(state.provision.output?.resourceGroupName);
        currentVmName = state.provision.output.vmName;
        currentResourceGroupName = state.provision.output.resourceGroupName;

        const azureClient = await getAzureClient();
        
        const instanceState = await azureClient.getInstanceStatus(currentResourceGroupName, currentVmName);
        assert.strictEqual(instanceState, AzureVmStatus.Running);
    }).timeout(60*1000);


    it('should wait for instance readiness after deployment', async () => {
        await waitForInstanceReadiness('deployment');
    }).timeout(2*60*1000);


    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
            await instanceManager.stop({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();

            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Stopped);
        }).timeout(20*60*1000); // 20 in timeout as stopping NC instances is very long
    }


    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should start instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
            await instanceManager.start({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();
            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.provisioned, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);

            const state = await getCurrentTestState();
            assert.ok(state.provision.output?.vmName);

            currentVmName = state.provision.output.vmName;
        }).timeout(2*60*1000);
    }

    it('should restart instance', async () => {

        const stateBefore = await getCurrentTestState();
        const vmNameBefore = stateBefore.provision.output?.vmName;

        assert.ok(vmNameBefore);

        const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
        await instanceManager.restart({ wait: true });

        const stateAfter = await getCurrentTestState();
        assert.strictEqual(stateAfter.provision.output?.vmName, vmNameBefore);

        const instanceStatus = await instanceManager.getInstanceStatus();
        assert.strictEqual(instanceStatus.configured, true);
        assert.strictEqual(instanceStatus.provisioned, true);
        assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);
    }).timeout(2*60*1000);

    it('should wait for instance readiness after restart', async () => {
        await waitForInstanceReadiness('restart');
    }).timeout(2*60*1000);

    it('should destroy instance', async () => {
        const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
        await instanceManager.destroy();
    }).timeout(20*60*1000); // large timeout as destroying NC instances is very long

    it('instance does not exist after destroy', async () => {
        const coreClient = new CloudypadClient({ config: coreConfig });
        const instances = await coreClient.getAllInstances();
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined);
    });
    

}).timeout(30*60*1000); // 30 minutes timeout as deployment and stopping instances may be long
