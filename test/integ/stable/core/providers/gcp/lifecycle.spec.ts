import * as assert from 'assert';
import { GcpClient, GcpInstanceStatus } from '../../../../../../src/providers/gcp/sdk-client';
import { GcpInstanceStateV1 } from '../../../../../../src/providers/gcp/state';
import { getIntegTestCoreConfig } from '../../../../utils';
import { GcpProviderClient } from '../../../../../../src/providers/gcp/provider';
import { ServerRunningStatus } from '../../../../../../src/core/runner';
import { getLogger } from '../../../../../../src/log/utils';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../../../src/core/const';
import { CloudypadClient } from '../../../../../../src/core/client';

// This test is run manually using an existing instance

describe('GCP lifecycle', () => {
    const logger = getLogger("test-gcp-lifecycle");
    const coreConfig = getIntegTestCoreConfig();
    const gcpProviderClient = new GcpProviderClient({ config: coreConfig });
    const instanceName = 'test-instance-gcp-lifecycle';

    const region = "europe-west4";
    const zone = "europe-west4-a";
    const machineType = "n1-standard-4";
    const acceleratorType = "nvidia-tesla-t4";
    const projectId = "crafteo-sandbox";

    let currentInstanceName: string | undefined = undefined;

    async function getCurrentTestState(): Promise<GcpInstanceStateV1> {
        return gcpProviderClient.getInstanceState(instanceName);
    }

    async function getGcpClient(): Promise<GcpClient> {
        const state = await getCurrentTestState();
        return new GcpClient(instanceName, state.provision.input.projectId);
    }

    async function waitForInstanceReadiness(scenario: string): Promise<void> {
        const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
        
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
        assert.strictEqual(currentInstanceName, undefined);

        const initializer = new GcpProviderClient({config: coreConfig}).getInstanceInitializer();
        await initializer.initializeStateOnly(instanceName, {
            ssh: {
                user: "ubuntu",
            },
            machineType: machineType,
            acceleratorType: acceleratorType,
            diskSize: 100,
            dataDiskSizeGb: 50,
            diskType: 'pd-balanced',
            networkTier: 'STANDARD',
            nicType: 'auto',
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            projectId: projectId,
            region: region,
            zone: zone,
            useSpot: false,
            costAlert: {
                limit: 2,
                notificationEmail: "test@test.com"
            },
            deleteInstanceServerOnStop: true,
            dataDiskSnapshot: {
                enable: true
            },
            baseImageSnapshot: {
                enable: true,
                keepOnDeletion: false
            }
        }, {
            sunshine: {
                enable: true,
                username: "sunshine",
                passwordBase64: Buffer.from("S3un$h1ne!").toString('base64'),
            }, 
        });
    })

    // it('should deploy instance', async () => {
    //     const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const gcpClient = await getGcpClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.instanceName);
    //     currentInstanceName = state.provision.output.instanceName;

    //     const instances = await gcpClient.listInstances(zone);
    //     const instance = instances.find(instance => instance.name === currentInstanceName);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.machineType?.split('/').pop(), machineType);
    // }).timeout(60*60*1000); // 60 minutes timeout as deployment may be long
 
    // it('should update instance', async () => {
    //     const instanceUpdater = gcpProviderClient.getInstanceUpdater();
    //     await instanceUpdater.updateStateOnly({
    //         instanceName: instanceName,
    //         provisionInputs: {
    //             machineType: "n1-standard-4",
    //         }, 
    //     });

    //     const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const gcpClient = await getGcpClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.instanceName);
    //     currentInstanceName = state.provision.output.instanceName;

    //     const instances = await gcpClient.listInstances(zone);
    //     const instance = instances.find(instance => instance.name === currentInstanceName);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.machineType?.split('/').pop(), "n1-standard-4");

    // }).timeout(15*60*1000);

    // it('should have a valid instance server output with existing server', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.instanceName);
    //     currentInstanceName = state.provision.output.instanceName;

    //     const gcpClient = await getGcpClient();
        
    //     const instanceState = await gcpClient.getInstanceState(zone, currentInstanceName);
    //     assert.strictEqual(instanceState, GcpInstanceStatus.Running);
    // }).timeout(2*60*1000);

    // it('should wait for instance readiness after deployment', async () => {
    //     await waitForInstanceReadiness('deployment');
    // }).timeout(2*60*1000);

    // it('should have created base image after deployment', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.baseImageId, 'Base image ID should be set');
        
    //     const gcpClient = await getGcpClient();
    //     const image = await gcpClient.getImage(state.provision.output.baseImageId);
        
    //     assert.ok(image, 'Base image should exist in GCP');
    //     assert.strictEqual(image.status, 'READY', 'Base image should be ready');
    // }).timeout(10000);

    // it('should have created data disk', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.dataDiskId, 'Data disk ID should be set');
        
    //     const gcpClient = await getGcpClient();
    //     const disk = await gcpClient.getDisk(zone, state.provision.output.dataDiskId);
        
    //     assert.ok(disk, 'Data disk should exist in GCP');
    //     assert.strictEqual(disk.sizeGb, '50', 'Data disk size should be 50 GB');
    // }).timeout(10000);

    // it('should have created root disk', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.rootDiskId, 'Root disk ID should be set');
        
    //     const gcpClient = await getGcpClient();
    //     const disk = await gcpClient.getDisk(zone, state.provision.output.rootDiskId);
        
    //     assert.ok(disk, 'Root disk should exist in GCP');
    // }).timeout(10000); // 10 seconds timeout as creating root disk is very long

    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
    //         await instanceManager.stop({ wait: true });

    //         const instanceStatus = await instanceManager.getInstanceStatus();

    //         assert.strictEqual(instanceStatus.configured, true);
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Stopped);
    //     }).timeout(20*60*1000); // 20 in timeout as stopping n1 instances is very long
    // }

    // it('should have created data disk snapshot after stop', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.dataDiskSnapshotId, 'Data disk snapshot ID should be set');
        
    //     const gcpClient = await getGcpClient();
    //     const snapshot = await gcpClient.getSnapshot(state.provision.output.dataDiskSnapshotId);
        
    //     assert.ok(snapshot, 'Data disk snapshot should exist in GCP');
    //     assert.strictEqual(snapshot.status, 'READY', 'Snapshot should be ready');
    // }).timeout(10000);

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should start instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
            await instanceManager.start({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();
            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.provisioned, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);

            const state = await getCurrentTestState();
            assert.ok(state.provision.output?.instanceName);

            currentInstanceName = state.provision.output.instanceName;
        }).timeout(10*60*1000);
    }

    it('should restart instance', async () => {

        const stateBefore = await getCurrentTestState();
        const instanceNameBefore = stateBefore.provision.output?.instanceName;

        assert.ok(instanceNameBefore);

        const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
        await instanceManager.restart({ wait: true });

        const instanceStatus = await instanceManager.getInstanceStatus();
        assert.strictEqual(instanceStatus.configured, true);
        assert.strictEqual(instanceStatus.provisioned, true);
        assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);
    }).timeout(10*60*1000);

    it('should wait for instance readiness after restart', async () => {
        await waitForInstanceReadiness('restart');
    }).timeout(2*60*1000);

    // it('should destroy instance', async () => {
    //     const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.destroy();
    // }).timeout(20*60*1000); // large timeout as destroying n1 instances is very long

    // it('should have deleted base image and data disk snapshot after destroy', async () => {
    //     const state = await getCurrentTestState();
        
    //     // Base image should be deleted since keepOnDeletion is false
    //     if (state.provision.output?.baseImageId) {
    //         const gcpClient = await getGcpClient();
    //         const image = await gcpClient.getImage(state.provision.output.baseImageId);
    //         assert.strictEqual(image, null, 'Base image should be deleted');
    //     }
        
    //     // Data disk snapshot should be deleted
    //     if (state.provision.output?.dataDiskSnapshotId) {
    //         const gcpClient = await getGcpClient();
    //         const snapshot = await gcpClient.getSnapshot(state.provision.output.dataDiskSnapshotId);
    //         assert.strictEqual(snapshot, null, 'Data disk snapshot should be deleted');
    //     }
    // }).timeout(2*60*1000);

    // it('instance does not exist after destroy', async () => {
    //     const coreClient = new CloudypadClient({ config: coreConfig });
    //     const instances = await coreClient.getAllInstances();
    //     assert.strictEqual(instances.find(instance => instance === instanceName), undefined);
    // });
    

}).timeout(30*60*1000); // 30 minutes timeout as deployment and stopping instances may be long
 