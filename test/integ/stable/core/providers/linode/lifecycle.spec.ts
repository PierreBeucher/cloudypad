import * as assert from 'assert'
import { LinodeClient } from '../../../../../../src/providers/linode/sdk-client'
import { LinodeInstanceStateV1 } from '../../../../../../src/providers/linode/state'
import { getIntegTestCoreConfig, runVerifyPlaybook } from '../../../../utils'
import { LinodeProviderClient } from '../../../../../../src/providers/linode/provider'
import { ServerRunningStatus } from '../../../../../../src/core/runner'
import { getLogger } from '../../../../../../src/log/utils'
import { CloudypadClient } from '../../../../../../src/core/client'

// This test is run manually using an existing instance

describe('Linode lifecycle', () => {
    const logger = getLogger("test-linode-lifecycle")
    const coreConfig = getIntegTestCoreConfig()
    const linodeProviderClient = new LinodeProviderClient({ config: coreConfig })

    // Keep a long name (50+ characters) to test Linode label generation
    // Linode labels and tags can't be longer than 50 chars, using a long name
    // will ensure we don't hit the limit
    const instanceName = 'test-instance-linode-lifecycle-from-image-with-long-name'

    // Linode test configuration
    const region = "fr-par"
    const instanceType = "g2-gpu-rtx4000a1-s"
    const rootDiskSizeGb = 25
    const dataDiskSizeGb = 10

    async function getCurrentTestState(): Promise<LinodeInstanceStateV1> {
        return linodeProviderClient.getInstanceState(instanceName)
    }

    function getLinodeClient(): LinodeClient {    
        return new LinodeClient({
            region: region,
        })
    }

    async function runVerify(opts: { createDataDiskTestFile?: boolean, checkDataDiskTestFile?: boolean } = {}): Promise<void> {
        const state = await getCurrentTestState()
        await runVerifyPlaybook(instanceName, state, opts)
    }
    
    it('should initialize instance state', async () => {

        const initializer = new LinodeProviderClient({config: coreConfig}).getInstanceInitializer()
            await initializer.initializeStateOnly(instanceName, {
                ssh: {
                    user: "root",
                    privateKeyPath: "/home/pbeucher/.ssh/id_ed25519",
                },
                region: region,
                instanceType: instanceType,
                rootDiskSizeGb: rootDiskSizeGb,
                dataDiskSizeGb: dataDiskSizeGb,
                // imageId: "private/33927621",
                watchdogEnabled: true, // need to have watchdog otherwise Ansible reboot during config will effectively shutdown instance
                dns: {
                    domainName: "green.instances.cloudypad.gg",
                },
                deleteInstanceServerOnStop: true,
                baseImageSnapshot: {
                    enable: true,
                },
                additionalLabels: ['test-label-1', 'test-label-2'],
            }, {
                sunshine: {
                    enable: true,
                    username: "sunshine",
                    passwordBase64: Buffer.from("Sunshine!").toString('base64'),
                    imageTag: "dev"
                }, 
                // ansible: {
                //     additionalArgs: "-t data-disk,sunshine"
                // }
            })
    })

    it('should deploy instance', async () => {
        const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        await instanceManager.deploy()

        const state = await getCurrentTestState()

        assert.ok(state.provision.output?.instanceServerId)
        const currentInstanceServerId = state.provision.output.instanceServerId

        // Verify the instance was created with correct specifications
        const linodeClient = getLinodeClient()
        await linodeClient.checkAuth()
        const instanceDetails = await linodeClient.getLinode(currentInstanceServerId)
        assert.ok(instanceDetails, 'Instance details should be available')
        assert.strictEqual(instanceDetails.type, instanceType)

        // Check data disk exists
        assert.ok(state.provision.output?.dataDiskId, "dataDiskId should be in output after deployment")

        // Check root disk exists
        assert.ok(state.provision.output?.rootDiskId, "rootDiskId should be in output after deployment")

        // Check base image exists
        assert.ok(state.provision.output?.baseImageId, "baseImageId should be in output after deployment")
    }).timeout(30*60*1000) // 30 minutes timeout, 
    // may be long as Linode instances are slow to start and creating image snapshot may be long

    it('should have resources matching state output after deployment', async () => {
        const linodeClient = getLinodeClient()
        const state = await getCurrentTestState()

        // Verify base image exists and ID matches state output
        if (state.provision.output?.baseImageId) {
            const image = await linodeClient.getImage(state.provision.output.baseImageId)
            assert.ok(image, 'Base image should exist in Linode')
            // Linode image IDs are like "private/12345678" or "linode/ubuntu22.04"
            // The ID from state should match the image.id
            assert.strictEqual(image.id, state.provision.output.baseImageId, 'Base image ID should match state output')
        }
    }).timeout(10000)

    it('should have a valid outputs and infrastructure matching outputs', async () => {
        const state = await getCurrentTestState()
        const linodeClient = getLinodeClient()
        
        assert.ok(state.provision.output?.instanceServerId)
        const currentInstanceServerId = state.provision.output.instanceServerId

        // Check instance server status
        const serverStatus = await linodeClient.getInstanceStatus(currentInstanceServerId)
        assert.equal(serverStatus, 'running', 'Instance should be running')

        // Verify instance has correct labels
        const instance = await linodeClient.getLinode(currentInstanceServerId)
        assert.ok(instance, 'Instance should exist')
        
        const expectedAdditionalLabels = ['test-label-1', 'test-label-2']
        const actualTags = instance.tags || []

        // Check that all additional labels are present
        for (const expectedLabel of expectedAdditionalLabels) {
            assert.ok(
                actualTags.includes(expectedLabel),
                `Instance should have additional label '${expectedLabel}'. Actual tags: ${JSON.stringify(actualTags)}`
            )
        }

        // Ensure there is at least one instance-name tag generated by Pulumi/linodeLabel
        assert.ok(
            actualTags.some(tag => tag.startsWith('instance-')),
            `Instance should have an 'instance-' tag derived from instance name. Actual tags: ${JSON.stringify(actualTags)}`
        )

        // Verify data disk has correct labels
        assert.ok(state.provision.output?.dataDiskId, 'Data disk ID should be in output')
        // dataDiskId is a filesystem path basename like "scsi-0Linode_Volume_my-instance-vol"
        // Extract the volume label by removing the "scsi-0Linode_Volume_" prefix
        const volumeLabel = state.provision.output.dataDiskId.replace(/^scsi-0Linode_Volume_/, '')
        const volume = await linodeClient.getVolumeByLabel(volumeLabel)
        assert.ok(volume, 'Data volume should exist in Linode')
        
        // Expected additional labels from state
        const volumeExpectedTags = ['test-label-1', 'test-label-2']
        const volumeActualTags = volume.tags || []

        // Check that all additional labels are present
        for (const expectedTag of volumeExpectedTags) {
            assert.ok(
                volumeActualTags.includes(expectedTag),
                `Data disk should have additional label '${expectedTag}'. Actual tags: ${JSON.stringify(volumeActualTags)}`
            )
        }

        // Ensure there is at least one instance-name tag generated by Pulumi/linodeLabel
        assert.ok(
            volumeActualTags.some(tag => tag.startsWith('instance-')),
            `Data disk should have an 'instance-' tag derived from instance name. Actual tags: ${JSON.stringify(volumeActualTags)}`
        )

        // should have a machineDataDiskLookupId
        assert.ok(state.provision.output?.machineDataDiskLookupId, "machineDataDiskLookupId should be in output")
        
    }).timeout(10000)

    it('should verify instance configuration after deployment', async () => {
        await runVerify({ createDataDiskTestFile: true })
    }).timeout(5*60*1000)

    it('should update instance data disk size', async () => {
        const instanceUpdater = linodeProviderClient.getInstanceUpdater()
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            provisionInputs: {
                dataDiskSizeGb: dataDiskSizeGb+2,
            }, 
        })

        const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        await instanceManager.deploy()

        const state = await getCurrentTestState()
        assert.ok(state.provision.output?.dataDiskId);

        const linodeClient = getLinodeClient()
        const dataDisk = await linodeClient.getVolumeByLabel(state.provision.output.dataDiskId);
        assert.ok(dataDisk);
        assert.strictEqual(dataDisk.size, (dataDiskSizeGb+2) * 1024 * 1024 * 1024); // 2GB in bytes

    }).timeout(30*60*1000) // 30 minutes timeout, might be long

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
            await instanceManager.stop({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.configured, false)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown)

            const state = await getCurrentTestState()
            assert.strictEqual(state.provision.output?.instanceServerId, undefined, "instanceServerId should be undefined after stop (server deleted)")
            assert.ok(state.provision.output?.dataDiskId, "dataDiskId should be set after stop")

            // Linode do not support data disk snapshots yet, 
            assert.strictEqual(state.provision.output?.dataDiskSnapshotId, undefined, "dataDiskSnapshotId should be undefined after stop")
            
        }).timeout(30*60*1000) // 30 minutes timeout, Linode instances are slow to start and stop

        it("should have no instance server and a live data disk after stop", async () => {
            
            // instance should be deleted on stop
            const state = await getCurrentTestState()
            const currentInstanceServerId = state.provision.output?.instanceServerId
            assert.strictEqual(currentInstanceServerId, undefined)

            const linodeClient = getLinodeClient()
            const instances = await linodeClient.listInstances()
            const instance = instances.find((instance) => instance.id.toString() === currentInstanceServerId)
            assert.ok(!instance)

            // Check data disk exists
            // dataDiskId is a filesystem path basename like "scsi-0Linode_Volume_my-instance-vol"
            // Extract the volume label by removing the "scsi-0Linode_Volume_" prefix
            assert.ok(state.provision.output?.dataDiskId)

            const volumeLabel = state.provision.output.dataDiskId.replace(/^scsi-0Linode_Volume_/, '')
            const volume = await linodeClient.getVolumeByLabel(volumeLabel)
            assert.ok(volume, 'Data volume should exist in Linode')
            assert.strictEqual(volume.label, volumeLabel, 'Data volume label should match')

        }).timeout(10000)
    }

    // run twice for idempotency
    for (let i = 0; i < 1; i++) {  // TODO 2

        it(`should start instance with re-provisioning (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
            await instanceManager.start({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.configured, true)
            assert.strictEqual(instanceStatus.provisioned, true)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running)

            const state = await getCurrentTestState()
            assert.ok(state.provision.output?.instanceServerId, "instanceServerId should exist after start")
            assert.ok(state.provision.output?.dataDiskId, "dataDiskId should exist after start")
        }).timeout(1200000) // 20 minutes timeout
    }

    it('should wait for instance readiness', async () => {
        const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        
        let isReady = false
        for (let attempt = 0; attempt < 60; attempt++) {
            isReady = await instanceManager.isReady()
            if (isReady) break
            logger.info(`Waiting for instance readiness... ${attempt + 1} / 60`)
            await new Promise(resolve => setTimeout(resolve, 5000)) // wait for 5 seconds before retrying
        }
        assert.strictEqual(isReady, true)

    }).timeout(120000)

    it('should verify instance configuration after stop/start', async () => {
        await runVerify({ checkDataDiskTestFile: true })
    }).timeout(5*60*1000)

    it('should restart instance without deleting or re-provisioning', async () => {

        const stateBefore = await getCurrentTestState()
        const serverIdBefore = stateBefore.provision.output?.instanceServerId

        assert.ok(serverIdBefore)

        const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        await instanceManager.restart({ wait: true })

        const stateAfter = await getCurrentTestState()
        assert.strictEqual(stateAfter.provision.output?.instanceServerId, serverIdBefore)
    }).timeout(120000)

    it('should destroy instance', async () => {
        const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        await instanceManager.destroy()
    }).timeout(120000)

    it('instance does not exist after destroy', async () => {
        const coreClient = new CloudypadClient({ config: coreConfig })
        const instances = await coreClient.getAllInstances()
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined)
    })
    

}).timeout(360000) 