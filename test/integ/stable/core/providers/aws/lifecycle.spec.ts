import * as assert from 'assert';
import { AwsClient } from '../../../../../../src/providers/aws/sdk-client';
import { AwsInstanceStateV1 } from '../../../../../../src/providers/aws/state';
import { getIntegTestCoreConfig } from '../../../../utils';
import { AwsProviderClient } from '../../../../../../src/providers/aws/provider';
import { ServerRunningStatus } from '../../../../../../src/core/runner';
import { getLogger } from '../../../../../../src/log/utils';
import { CloudypadClient } from '../../../../../../src/core/client';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../../../src/core/const';

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
    
    it('should initialize instance state', async () => {
        assert.strictEqual(currentInstanceId, undefined);

        const initializer = new AwsProviderClient({config: coreConfig}).getInstanceInitializer();
        await initializer.initializeStateOnly(instanceName, {
            ssh: {
                user: "ubuntu",
            },
            instanceType: instanceType,
            diskSize: 100,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: region,
            useSpot: false,
        }, {
            sunshine: {
                enable: true,
                username: "sunshine",
                passwordBase64: Buffer.from("S3un$h1ne!").toString('base64')
            }, 
        });
    })

    it('should deploy instance', async () => {
        const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const awsClient = getAwsClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.instanceId);
        currentInstanceId = state.provision.output.instanceId;

        const instances = await awsClient.listInstances();
        const instance = instances.find(instance => instance.InstanceId === currentInstanceId);
        assert.ok(instance);
        assert.strictEqual(instance.InstanceType, instanceType);
    }).timeout(20*60*1000); // 20 minutes timeout as deployment may be long
 
    it('should update instance', async () => {
        const instanceUpdater = awsProviderClient.getInstanceUpdater();
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            provisionInputs: {
                instanceType: "g4dn.2xlarge",
            }, 
        });

        const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
        await instanceManager.deploy();

        const awsClient = getAwsClient();
        const state = await getCurrentTestState();

        assert.ok(state.provision.output?.instanceId);
        currentInstanceId = state.provision.output.instanceId;

        const instances = await awsClient.listInstances();
        const instance = instances.find(instance => instance.InstanceId === currentInstanceId);
        assert.ok(instance);
        assert.strictEqual(instance.InstanceType, "g4dn.2xlarge");

    }).timeout(20*60*1000);

    it('should have a valid instance server output with existing server', async () => {
        const state = await getCurrentTestState();
        
        assert.ok(state.provision.output?.instanceId);
        currentInstanceId = state.provision.output.instanceId;

        const awsClient = getAwsClient();
        
        const instanceState = await awsClient.getInstanceState(currentInstanceId);
        assert.strictEqual(instanceState, "running");
    })

    it('should wait for instance readiness after deployment', async () => {
        await waitForInstanceReadiness();
    }).timeout(2*60*1000);

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
            await instanceManager.stop({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();

            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Stopped);
        }).timeout(20*60*1000); // 20 in timeout as stopping g4dn instances is very long
    }

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should start instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
            await instanceManager.start({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();
            assert.strictEqual(instanceStatus.configured, true);
            assert.strictEqual(instanceStatus.provisioned, true);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running);

            const state = await getCurrentTestState();
            assert.ok(state.provision.output?.instanceId);

            currentInstanceId = state.provision.output.instanceId;
        }).timeout(2*60*1000);
    }

    it('should restart instance', async () => {

        const stateBefore = await getCurrentTestState();
        const instanceIdBefore = stateBefore.provision.output?.instanceId;

        assert.ok(instanceIdBefore);

        const instanceManager = await awsProviderClient.getInstanceManager(instanceName);
        await instanceManager.restart({ wait: true });

        const stateAfter = await getCurrentTestState();
        assert.strictEqual(stateAfter.provision.output?.instanceId, instanceIdBefore);
    }).timeout(2*60*1000);

    it('should wait for instance readiness after restart', async () => {
        await waitForInstanceReadiness();
    }).timeout(2*60*1000);
    
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
