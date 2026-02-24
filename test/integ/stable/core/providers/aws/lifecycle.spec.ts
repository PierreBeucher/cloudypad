import * as assert from 'assert';
import { AwsClient } from '../../../../../../src/providers/aws/sdk-client';
import { AwsInstanceStateV1 } from '../../../../../../src/providers/aws/state';
import { getIntegTestCoreConfig } from '../../../../utils';
import { AwsProviderClient } from '../../../../../../src/providers/aws/provider';
import { ServerRunningStatus } from '../../../../../../src/core/runner';
import { getLogger } from '../../../../../../src/log/utils';
import { CloudypadClient } from '../../../../../../src/core/client';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../../../src/core/const';
import { InstanceStateName } from '@aws-sdk/client-ec2';

describe('AWS lifecycle', () => {
    const logger = getLogger("test-aws-lifecycle");
    const coreConfig = getIntegTestCoreConfig();
    const awsProviderClient = new AwsProviderClient({ config: coreConfig });
    const instanceName = 'test-instance-aws-lifecycle';

    const region = "eu-central-1";
    const instanceType = "g4dn.xlarge";

    let currentInstanceId: string | undefined = undefined;

    async function getCurrentTestState(): Promise<AwsInstanceStateV1> {
        return awsProviderClient.getInstanceState(instanceName);
    }

    function getAwsClient(): AwsClient {
        return new AwsClient(instanceName, region);
    }

    async function waitForInstanceReadiness(maxAttempts: number = 60): Promise<void> {
        const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const isReady = await instanceManager.isReady();
            if (isReady) return;
            logger.info(`Waiting for instance readiness... ${attempt + 1} / ${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 5 seconds before retrying
        }
        throw new Error(`Instance did not become ready after ${maxAttempts} attempts`);
    }
    
    // it('should initialize instance state', async () => {
    //     assert.strictEqual(currentInstanceId, undefined);

    //     const initializer = new AwsProviderClient({config: coreConfig}).getInstanceInitializer();
    //     await initializer.initializeStateOnly(instanceName, {
    //         ssh: {
    //             user: "ubuntu",
    //         },
    //         instanceType: instanceType,
    //         diskSize: 30,
    //         publicIpType: PUBLIC_IP_TYPE_STATIC,
    //         region: region,
    //         useSpot: false,
    //         dataDiskSizeGb: 35,
    //         baseImageSnapshot: {
    //             enable: true,
    //         },
    //         dataDiskSnapshot: {
    //             enable: true,
    //         },
    //         deleteInstanceServerOnStop: true,
    //     }, {
    //         sunshine: {
    //             enable: true,
    //             username: "sunshine",
    //             passwordBase64: Buffer.from("S3un$h1ne!").toString('base64')
    //         }, 
    //     });
    // })

    // it('should deploy instance', async () => {
    //     const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const awsClient = getAwsClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.instanceId);
    //     currentInstanceId = state.provision.output.instanceId;

    //     const instances = await awsClient.listInstances();
    //     const instance = instances.find(instance => instance.InstanceId === currentInstanceId);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.InstanceType, instanceType);
    // }).timeout(60*60*1000); // 60 minutes timeout as deployment and snapshot + AMI creation may be long

    // it('should have resources matching state output after deployment', async () => {
    //     const awsClient = getAwsClient();
    //     const state = await getCurrentTestState();

    //     // Verify data disk exists and ID matches state output
    //     if (state.provision.output?.dataDiskId) {
    //         const volume = await awsClient.getVolume(state.provision.output.dataDiskId);
    //         assert.ok(volume, "Data disk should exist in AWS");
    //         assert.strictEqual(volume.VolumeId, state.provision.output.dataDiskId, "Data disk ID should match state output");
    //     }

    //     // Verify root disk exists and ID matches state output
    //     if (state.provision.output?.rootDiskId) {
    //         const volume = await awsClient.getVolume(state.provision.output.rootDiskId);
    //         assert.ok(volume, "Root disk should exist in AWS");
    //         assert.strictEqual(volume.VolumeId, state.provision.output.rootDiskId, "Root disk ID should match state output");
    //     }

    //     // Verify base image exists and ID matches state output
    //     if (state.provision.output?.baseImageId) {
    //         const image = await awsClient.getImage(state.provision.output.baseImageId);
    //         assert.ok(image, "Base image should exist in AWS");
    //         assert.strictEqual(image.ImageId, state.provision.output.baseImageId, "Base image ID should match state output");
    //     }
    // }).timeout(10000);
 
    // it('should update instance', async () => {
    //     const instanceUpdater = awsProviderClient.getInstanceUpdater();
    //     await instanceUpdater.updateStateOnly({
    //         instanceName: instanceName,
    //         provisionInputs: {
    //             instanceType: "g4dn.2xlarge",
    //         }, 
    //     });

    //     const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.deploy();

    //     const awsClient = getAwsClient();
    //     const state = await getCurrentTestState();

    //     assert.ok(state.provision.output?.instanceId);
    //     currentInstanceId = state.provision.output.instanceId;

    //     const instances = await awsClient.listInstances();
    //     const instance = instances.find(instance => instance.InstanceId === currentInstanceId);
    //     assert.ok(instance);
    //     assert.strictEqual(instance.InstanceType, "g4dn.2xlarge");

    // }).timeout(30*60*1000);

    // it('should have a valid instance server output with existing server', async () => {
    //     const state = await getCurrentTestState();
        
    //     assert.ok(state.provision.output?.instanceId);
    //     currentInstanceId = state.provision.output.instanceId;

    //     const awsClient = getAwsClient();
        
    //     const instanceState = await awsClient.getInstanceState(currentInstanceId);
    //     assert.strictEqual(instanceState, "running");
    // })

    // it('should wait for instance readiness after deployment', async () => {
    //     await waitForInstanceReadiness();
    // }).timeout(2*60*1000);

    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
    //         const stateBeforeStop = await getCurrentTestState();
    //         const instanceIdBeforeStop = stateBeforeStop.provision.output?.instanceId;

    //         const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
    //         await instanceManager.stop({ wait: true });

    //         const instanceStatus = await instanceManager.getInstanceStatus();

    //         // server has been deleted, so it's not configured anymore and server is in unknown state
    //         assert.strictEqual(instanceStatus.configured, false);
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown);

    //         // Check that instance server is not found anymore (since deleteInstanceServerOnStop is enabled)
    //         const awsClient = getAwsClient();
    //         if (instanceIdBeforeStop) {
    //             const instanceState = await awsClient.getInstanceState(instanceIdBeforeStop);
    //             assert.ok(instanceState === undefined || instanceState === InstanceStateName.terminated);
    //         }

    //         // Check data disk snapshot has been created (find ID in state and check on AWS)
    //         const stateAfterStop = await getCurrentTestState();
    //         assert.strictEqual(stateAfterStop.provision.output?.instanceId, undefined);
    //         assert.strictEqual(stateAfterStop.provision.output?.dataDiskId, undefined);
    //         assert.ok(stateAfterStop.provision.output?.dataDiskSnapshotId, "dataDiskSnapshotId should be in output after stop");
    //         const snapshotExists = await awsClient.checkSnapshotExists(stateAfterStop.provision.output.dataDiskSnapshotId);
    //         assert.strictEqual(snapshotExists, true, `Data disk snapshot ${stateAfterStop.provision.output.dataDiskSnapshotId} should exist on AWS`);
    //     }).timeout(60*60*1000); // 1h timeout as stopping g4dn instances and creating data disk snapshot is very long
    // }

    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should start instance (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
    //         await instanceManager.start({ wait: true });

    //         const instanceStatus = await instanceManager.getInstanceStatus();
    //         assert.strictEqual(instanceStatus.configured, true);
    //         assert.strictEqual(instanceStatus.provisioned, true);
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);

    //         const state = await getCurrentTestState();
    //         assert.ok(state.provision.output?.instanceId, "instanceId should exist after start");
    //         assert.ok(state.provision.output?.dataDiskId, "dataDiskId should exist after start");
    //         assert.ok(state.provision.output?.dataDiskSnapshotId, "dataDiskSnapshotId should exist after start");

    //         currentInstanceId = state.provision.output.instanceId;
    //     }).timeout(20*60*1000);
    // }

    // it('should restart instance', async () => {

    //     const stateBefore = await getCurrentTestState();
    //     const instanceIdBefore = stateBefore.provision.output?.instanceId;

    //     assert.ok(instanceIdBefore);

    //     const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
    //     await instanceManager.restart({ wait: true });

    //     const stateAfter = await getCurrentTestState();
    //     assert.strictEqual(stateAfter.provision.output?.instanceId, instanceIdBefore);
    // }).timeout(2*60*1000);

    // it('should wait for instance readiness after restart', async () => {
    //     await waitForInstanceReadiness();
    // }).timeout(2*60*1000);
    
    it('should destroy instance', async () => {
        const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
        await instanceManager.destroy();
    }).timeout(20*60*1000); // large timeout as destroying g4dn instances is very long

    it('instance does not exist after destroy', async () => {
        const coreClient = new CloudypadClient({ config: coreConfig });
        const instances = await coreClient.getAllInstances();
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined);
    });
    

}).timeout(30*60*1000); // 30 minutes timeout as deployment and stopping instances may be long
