import * as assert from 'assert';
import { fetchCurrentIpCidrs } from '../../../../../../src/tools/ip';
import { GcpClient, GcpInstanceStatus } from '../../../../../../src/providers/gcp/sdk-client';
import { GcpInstanceStateV1 } from '../../../../../../src/providers/gcp/state';
import { getIntegTestCoreConfig, runVerifyPlaybook } from '../../../../utils';
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

    // Restrict access to the current host external IP so Ansible can still reach the instance.
    // Fetched fresh on each test that needs it (at init and verification time) so that test phases
    // can run independently across iterations.
    async function getCurrentAllowedCidrs(): Promise<{ ipv4: string[], ipv6: string[] }> {
        const cidrs = await fetchCurrentIpCidrs()
        const result = {
            ipv4: cidrs.ipv4,
            ipv6: cidrs.ipv6.length > 0 ? cidrs.ipv6 : ['::/0'],
        }
        logger.info(`Using allowedCidrs: ${JSON.stringify(result)}`)
        return result
    }

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

    async function runVerify(opts: { createDataDiskTestFile?: boolean, checkDataDiskTestFile?: boolean } = {}): Promise<void> {
        const state = await getCurrentTestState()
        await runVerifyPlaybook(instanceName, state, opts)
    }
    
    it('should initialize instance state', async () => {
        assert.strictEqual(currentInstanceName, undefined);

        const allowedCidrs = await getCurrentAllowedCidrs()

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
            },
            allowedCidrs: allowedCidrs,
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
    }).timeout(60*60*1000); // 60 minutes timeout as deployment may be long

    it('should wait for instance readiness after deployment', async () => {
        await waitForInstanceReadiness('deployment');
    }).timeout(2*60*1000);

    it('should verify instance configuration after deployment', async () => {
        await runVerify({ createDataDiskTestFile: true })
    }).timeout(5*60*1000);

    it('should have valid instance outputs', async () => {
        const gcpClient = await getGcpClient();
        const state = await getCurrentTestState();
        
        assert.ok(state.provision.output?.instanceName);
        currentInstanceName = state.provision.output.instanceName;
        
        const instanceState = await gcpClient.getInstanceState(zone, currentInstanceName);
        assert.strictEqual(instanceState, GcpInstanceStatus.Running);

        // should have a machineDataDiskLookupId for Ansible data disk mount
        assert.ok(state.provision.output?.machineDataDiskLookupId, "machineDataDiskLookupId should be in output")

        // Verify data disk exists and ID matches state output
        assert.ok(state.provision.output?.dataDiskId, 'dataDiskId should be in output');
        {
            const dataDiskId = state.provision.output.dataDiskId;
            const disk = await gcpClient.getDisk(zone, dataDiskId);
            assert.ok(disk, 'Data disk should exist in GCP');
            assert.strictEqual(disk.name, dataDiskId, 'Data disk ID should match state output');
            assert.strictEqual(disk.sizeGb, '50', 'Data disk size should be 50 GB');
        }

        // Verify root disk exists and ID matches state output
        assert.ok(state.provision.output?.rootDiskId, 'rootDiskId should be in output');
        {
            const rootDiskId = state.provision.output.rootDiskId;
            const disk = await gcpClient.getDisk(zone, rootDiskId);
            assert.ok(disk, 'Root disk should exist in GCP');
            assert.strictEqual(disk.name, rootDiskId, 'Root disk ID should match state output');
        }

        // Verify base image exists and ID matches state output
        assert.ok(state.provision.output?.baseImageId, 'baseImageId should be in output');
        const baseImageId = state.provision.output.baseImageId;
        const image = await gcpClient.getImage(baseImageId);
        assert.ok(image, 'Base image should exist in GCP');
        
        // Normalize both values - extract image name from URI if needed
        // State may store full URI (projects/{projectId}/global/images/{imageName}) or just the name
        const stateImageName = baseImageId.includes('/')
            ? baseImageId.split('/').pop()!
            : baseImageId;
        assert.strictEqual(image.name, stateImageName, 'Base image ID should match state output');
        assert.strictEqual(image.status, 'READY', 'Base image should be ready');

        // Verify firewall ingress rules contain the configured allowedCidrs
        // GCP firewall sourceRanges accepts both IPv4 and IPv6 CIDRs in the same list
        const firewallName = `cloudypad-${instanceName}`.toLowerCase();
        const firewall = await gcpClient.getFirewall(firewallName);
        assert.ok(firewall, `Firewall ${firewallName} should exist in GCP`);
        const sourceRanges = firewall.sourceRanges ?? [];
        const expectedAllowedCidrs = await getCurrentAllowedCidrs()
        for (const cidr of [...expectedAllowedCidrs.ipv4, ...expectedAllowedCidrs.ipv6]) {
            assert.ok(sourceRanges.includes(cidr), `CIDR ${cidr} should be in firewall sourceRanges. Found: ${JSON.stringify(sourceRanges)}`);
        }
    }).timeout(60*1000);

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

        assert.ok(state.provision.output?.dataDiskId);
        const dataDisk = await gcpClient.getDisk(zone, state.provision.output.dataDiskId);
        assert.ok(dataDisk);
        assert.strictEqual(dataDisk.sizeGb, 50);

    }).timeout(15*60*1000);

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await gcpProviderClient.getInstanceManager(instanceName);
            await instanceManager.stop({ wait: true });

            const instanceStatus = await instanceManager.getInstanceStatus();

            assert.strictEqual(instanceStatus.configured, false);
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown);

            const state = await getCurrentTestState();
            assert.strictEqual(state.provision.output?.dataDiskId, undefined, "dataDiskId should be undefined after stop");
        }).timeout(20*60*1000); // 20 in timeout as stopping n1 instances is very long
    }

    it('should have created data disk snapshot after stop', async () => {
        const state = await getCurrentTestState();
        
        assert.ok(state.provision.output?.dataDiskSnapshotId, 'Data disk snapshot ID should be set');
        
        const gcpClient = await getGcpClient();
        const snapshot = await gcpClient.getSnapshot(state.provision.output.dataDiskSnapshotId);
        
        assert.ok(snapshot, 'Data disk snapshot should exist in GCP');
        assert.strictEqual(snapshot.status, 'READY', 'Snapshot should be ready');
    }).timeout(10000);

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

    it('should wait for instance readiness after start', async () => {
        await waitForInstanceReadiness('start');
    }).timeout(2*60*1000);

    it('should verify instance configuration after stop/start', async () => {
        await runVerify({ checkDataDiskTestFile: true })
    }).timeout(5*60*1000);

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
 