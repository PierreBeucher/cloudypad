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
    const zone = "europe-west4-b";
    const machineType = "n1-standard-8";
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
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            projectId: projectId,
            region: region,
            zone: zone,
            useSpot: true,
            costAlert: {
                limit: 2,
                notificationEmail: "test@test.com"
            }
        }, {
            sunshine: {
                enable: true,
                username: "sunshine",
                passwordBase64: Buffer.from("S3un$h1ne!").toString('base64'),
            }, 
        });
    })

    it('should deploy instance', async () => {
        const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const gcpClient = await getGcpClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.instanceName);
        currentInstanceName = state.provision.output.instanceName;

        const instances = await gcpClient.listInstances(zone);
        const instance = instances.find(instance => instance.name === currentInstanceName);
        assert.ok(instance);
        assert.strictEqual(instance.machineType?.split('/').pop(), machineType);
    }).timeout(20*60*1000); // 20 minutes timeout as deployment may be long
 
    it('should update instance', async () => {
        const instanceUpdater = gcpProviderClient.getInstanceUpdater();
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            provisionInputs: {
                machineType: "n1-standard-4",
            }, 
        });

        const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const gcpClient = await getGcpClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.instanceName);
        currentInstanceName = state.provision.output.instanceName;

        const instances = await gcpClient.listInstances(zone);
        const instance = instances.find(instance => instance.name === currentInstanceName);
        assert.ok(instance);
        assert.strictEqual(instance.machineType?.split('/').pop(), "n1-standard-4");

    }).timeout(15*60*1000);

    it('should have a valid instance server output with existing server', async () => {
        const state = await getCurrentTestState();
        
        assert.ok(state.provision.output?.instanceName);
        currentInstanceName = state.provision.output.instanceName;

        const gcpClient = await getGcpClient();
        
        const instanceState = await gcpClient.getInstanceState(zone, currentInstanceName);
        assert.strictEqual(instanceState, GcpInstanceStatus.Running);
    }).timeout(2*60*1000);

    it('should wait for instance readiness after deployment', async () => {
        await waitForInstanceReadiness('deployment');
    }).timeout(2*60*1000);

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
            await instanceManager.stop({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();

            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Stopped);
        }).timeout(20*60*1000); // 20 in timeout as stopping n1 instances is very long
    }

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
        }).timeout(2*60*1000);
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
    }).timeout(2*60*1000);

    it('should wait for instance readiness after restart', async () => {
        await waitForInstanceReadiness('restart');
    }).timeout(2*60*1000);

    it('should destroy instance', async () => {
        const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
        await instanceManager.destroy();
    }).timeout(20*60*1000); // large timeout as destroying n1 instances is very long

    it('instance does not exist after destroy', async () => {
        const coreClient = new CloudypadClient({ config: coreConfig });
        const instances = await coreClient.getAllInstances();
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined);
    });
    

}).timeout(30*60*1000); // 30 minutes timeout as deployment and stopping instances may be long
 