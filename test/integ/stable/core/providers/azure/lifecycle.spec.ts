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
    
    // it('should initialize instance state', async () => {
    //     assert.strictEqual(currentVmName, undefined);

    //     const initializer = new AzureProviderClient({config: coreConfig}).getInstanceInitializer();
    //     await initializer.initializeStateOnly(instanceName, {
    //         ssh: {
    //             user: "ubuntu",
    //         },
    //         vmSize: vmSize,
    //         diskSize: 100,  // Root disk size (OS) - increased to 100GB to accommodate base images
    //         dataDiskSizeGb: 100,  // Data disk size
    //         diskType: "Standard_LRS",
    //         publicIpType: PUBLIC_IP_TYPE_STATIC,
    //         subscriptionId: "0dceb5ed-9096-4db7-b430-2609e7cc6a15",
    //         location: location,
    //         useSpot: false,
    //         deleteInstanceServerOnStop: true,  // Enable server deletion on stop
    //         dataDiskSnapshot: {
    //             enable: true,  // Enable data disk snapshot
    //         },
    //         baseImageSnapshot: {
    //             enable: true,  // Enable base image
    //             keepOnDeletion: false,
    //         },
    //         costAlert: {
    //             limit: 2,
    //             notificationEmail: "test@test.com"
    //         }
    //     }, {
    //         wolf: {
    //             enable: true
    //         }, 
    //     });
    // })

    // it('should deploy instance', async () => {
    //     const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const azureClient = await getAzureClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.vmName);
    //     assert.ok(state.provision.output?.resourceGroupName);
    //     assert.ok(state.provision.output?.rootDiskId, "Root disk ID should be set");
    //     assert.ok(state.provision.output?.dataDiskId, "Data disk ID should be set");
    //     assert.ok(state.provision.output?.baseImageId, "Base image ID should be set after deploy");
    //     currentVmName = state.provision.output.vmName;
    //     currentResourceGroupName = state.provision.output.resourceGroupName;

    //     const instances = await azureClient.listInstances();
    //     const instance = instances.find(instance => instance.name === currentVmName);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.hardwareProfile?.vmSize, vmSize);
    // }).timeout(30*60*1000); // 30 minutes timeout as deployment with image creation may be long

    // it('should have resources matching state output after deployment', async () => {
    //     const azureClient = await getAzureClient();
    //     const state = await getCurrentTestState();
    //     const resourceGroupName = state.provision.output?.resourceGroupName;
        
    //     assert.ok(resourceGroupName, "resourceGroupName should be set");

    //     // Verify data disk exists and ID matches state output
    //     if (state.provision.output?.dataDiskId) {
    //         const dataDiskName = `${instanceName}-data-disk`;
    //         const dataDisk = await azureClient.getDisk(resourceGroupName, dataDiskName);
    //         assert.ok(dataDisk, "Data disk should exist in Azure");
    //         assert.strictEqual(dataDisk.id, state.provision.output.dataDiskId, "Data disk ID should match state output");
    //         assert.strictEqual(dataDisk.diskSizeGB, 100, "Data disk size should be 100 GB");
    //     }

    //     // Verify root disk exists and ID matches state output
    //     if (state.provision.output?.rootDiskId) {
    //         const rootDiskName = `${instanceName}-osdisk`;
    //         const rootDisk = await azureClient.getDisk(resourceGroupName, rootDiskName);
    //         assert.ok(rootDisk, "Root disk should exist in Azure");
    //         assert.strictEqual(rootDisk.id, state.provision.output.rootDiskId, "Root disk ID should match state output");
    //     }

    //     // Verify base image exists and ID matches state output
    //     if (state.provision.output?.baseImageId) {
    //         const baseImageName = `${instanceName}-base-image`;
    //         const baseImage = await azureClient.getImage(resourceGroupName, baseImageName);
    //         assert.ok(baseImage, "Base image should exist in Azure");
    //         assert.strictEqual(baseImage.id, state.provision.output.baseImageId, "Base image ID should match state output");
    //     }
    // }).timeout(10000);

    // it('should update instance', async () => {
    //     const instanceUpdater = azureProviderClient.getInstanceUpdater();
    //     await instanceUpdater.updateStateOnly({
    //         instanceName: instanceName,
    //         provisionInputs: {
    //             vmSize: "Standard_NC4as_T4_v3",
    //         }, 
    //     });

    //     const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const azureClient = await getAzureClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.vmName);
    //     currentVmName = state.provision.output.vmName;

    //     const instances = await azureClient.listInstances();
    //     const instance = instances.find(instance => instance.name === currentVmName);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.hardwareProfile?.vmSize, "Standard_NC4as_T4_v3");

    // }).timeout(15*60*1000);


    // it('should have a valid instance server output with existing server', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.vmName);
    //     assert.ok(state.provision.output?.resourceGroupName);
    //     currentVmName = state.provision.output.vmName;
    //     currentResourceGroupName = state.provision.output.resourceGroupName;

    //     const azureClient = await getAzureClient();
        
    //     const instanceState = await azureClient.getInstanceStatus(currentResourceGroupName, currentVmName);
    //     assert.strictEqual(instanceState, AzureVmStatus.Running);
    // }).timeout(60*1000);


    // it('should wait for instance readiness after deployment', async () => {
    //     await waitForInstanceReadiness('deployment');
    // }).timeout(2*60*1000);


    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
    //         await instanceManager.stop({ wait: true });

    //         const instanceStatus = await instanceManager.getInstanceStatus();
    //         const state = await getCurrentTestState();
    //         const azureClient = await getAzureClient();

    //         // When server is deleted, configuration output is reset, so configured is false
    //         assert.strictEqual(instanceStatus.configured, false);
    //         // When server is deleted, status is Unknown (can't query a non-existent server)
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown);

    //         // Since deleteInstanceServerOnStop is enabled, VM should be deleted (vmName should be undefined)
    //         assert.strictEqual(state.provision.output?.vmName, undefined, "VM should be deleted when stopped with deleteInstanceServerOnStop enabled");
    //         assert.strictEqual(state.provision.output?.dataDiskId, undefined, "dataDiskId should be undefined after stop");

    //         // Verify data disk snapshot was created
    //         assert.ok(state.provision.output?.dataDiskSnapshotId, "Data disk snapshot should be created on stop");
    //         const dataDiskSnapshotName = `${instanceName}-data-disk-snapshot`;
    //         const dataDiskSnapshot = await azureClient.getSnapshot(state.provision.output.resourceGroupName, dataDiskSnapshotName);
    //         assert.ok(dataDiskSnapshot, "Data disk snapshot should exist in Azure");
    //     }).timeout(30*60*1000); // Increased timeout for snapshot creation and VM deletion
    // }


    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should start instance (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
    //         await instanceManager.start({ wait: true });

    //         const instanceStatus = await instanceManager.getInstanceStatus();
    //         assert.strictEqual(instanceStatus.configured, true);
    //         assert.strictEqual(instanceStatus.provisioned, true);
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);

    //         const state = await getCurrentTestState();
    //         assert.ok(state.provision.output?.vmName, "VM should be recreated on start");
    //         assert.ok(state.provision.output?.dataDiskId, "Data disk should be restored from snapshot");
    //         assert.ok(state.provision.output?.dataDiskSnapshotId, "dataDiskSnapshotId should exist after start");
    //         assert.ok(state.provision.output?.baseImageId, "Base image should be used to recreate VM");

    //         currentVmName = state.provision.output.vmName;

    //         // Verify VM was recreated from base image in Azure
    //         const azureClient = await getAzureClient();
    //         const instances = await azureClient.listInstances();
    //         const instance = instances.find(inst => inst.name === currentVmName);
    //         assert.ok(instance, "VM should exist in Azure after start");
    //     }).timeout(20*60*1000); // Increased timeout for VM recreation from image
    // }

    // it('should restart instance', async () => {

    //     const stateBefore = await getCurrentTestState();
    //     const vmNameBefore = stateBefore.provision.output?.vmName;

    //     assert.ok(vmNameBefore);

    //     const instanceManager = await azureProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.restart({ wait: true });

    //     const stateAfter = await getCurrentTestState();
    //     assert.strictEqual(stateAfter.provision.output?.vmName, vmNameBefore);

    //     const instanceStatus = await instanceManager.getInstanceStatus();
    //     assert.strictEqual(instanceStatus.configured, true);
    //     assert.strictEqual(instanceStatus.provisioned, true);
    //     assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);
    // }).timeout(2*60*1000);

    // it('should wait for instance readiness after restart', async () => {
    //     await waitForInstanceReadiness('restart');
    // }).timeout(2*60*1000);

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
