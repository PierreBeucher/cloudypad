import * as assert from 'assert'
import { ScalewayClient, ScalewayServerState } from '../../../../../../src/providers/scaleway/sdk-client'
import { ScalewayInstanceStateV1 } from '../../../../../../src/providers/scaleway/state'
import { getIntegTestCoreConfig, runVerifyPlaybook, RunVerifyPlaybookOpts } from '../../../../utils'
import { ScalewayProviderClient } from '../../../../../../src/providers/scaleway/provider'
import { ServerRunningStatus } from '../../../../../../src/core/runner'
import { getLogger } from '../../../../../../src/log/utils'
import { CloudypadClient } from '../../../../../../src/core/client'

// This test is run manually using an existing instance

describe('Scaleway lifecycle', () => {
    const logger = getLogger("test-scaleway-lifecycle")
    const coreConfig = getIntegTestCoreConfig()
    const scalewayProviderClient = new ScalewayProviderClient({ config: coreConfig })
    const instanceName = 'test-instance-scaleway-lifecycle'

    const projectId = "02d02f86-9414-4161-b807-efb2bd22d266"
    const region = "fr-par"
    const zone = "fr-par-2"
    const dnsZone = "test-core.cloudypad.gg"
    const dnsRecordName = "instance-lifecycle"

    let currentInstanceServerId: string | undefined = undefined

    async function getCurrentTestState(): Promise<ScalewayInstanceStateV1> {
        return scalewayProviderClient.getInstanceState(instanceName)
    }

    function getScalewayClient(): ScalewayClient {    
        return new ScalewayClient(instanceName, {
            projectId: projectId,
            region: region,
            zone: zone,
        })
    }

    async function runVerify(opts?: RunVerifyPlaybookOpts): Promise<void> {
        const state = await getCurrentTestState()
        await runVerifyPlaybook(instanceName, state, opts)
    }
    
    it('should initialize instance state', async () => {

        assert.strictEqual(currentInstanceServerId, undefined)

        const initializer = new ScalewayProviderClient({config: coreConfig}).getInstanceInitializer()
            await initializer.initializeStateOnly(instanceName, {
                ssh: {
                    user: "ubuntu",
                },
                projectId: projectId,
                region: region,
                zone: zone,
                instanceType: "L4-1-24G",
                diskSizeGb: 30,
                dataDiskSizeGb: 50,
                baseImageSnapshot: {
                    enable: true,
                },
                dataDiskSnapshot: {
                    enable: true,
                },
                deleteInstanceServerOnStop: true,
                dns: {
                    domainName: dnsZone,
                    record: dnsRecordName,
                },
            }, {
                sunshine: {
                    enable: true,
                    username: "sunshine",
                    passwordBase64: Buffer.from("Sunshine!").toString('base64'),
                    imageTag: "dev"
                },
                ratelimit: {
                    maxMbps: 50,
                },
            })
    })

    it('should deploy instance', async () => {
        const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
        await instanceManager.deploy()

        const scalewayClient = getScalewayClient()
        const state = await getCurrentTestState()

        assert.ok(state.provision.output?.instanceServerId)
        currentInstanceServerId = state.provision.output.instanceServerId

        const serverData = await scalewayClient.getRawServerData(currentInstanceServerId)
        assert.strictEqual(serverData?.commercialType, "L4-1-24G")
    }).timeout(20*60*1000) // 20 minutes timeout

    it('should have valid instance outputs', async () => {
        const scalewayClient = getScalewayClient()
        const state = await getCurrentTestState()

        // should have a machineDataDiskLookupId for Ansible data disk mount
        assert.ok(state.provision.output?.machineDataDiskLookupId, "machineDataDiskLookupId should be in output")

        // Helper to extract ID from zone-prefixed ID or plain ID
        const extractId = (id: string): string => id.includes('/') ? id.split('/').pop()! : id

        // Verify data disk exists and ID matches state output
        assert.ok(state.provision.output?.dataDiskId, "dataDiskId should be in output")
        const dataDiskId = extractId(state.provision.output.dataDiskId)
        const dataVolume = await scalewayClient.getVolume({ zone: zone, volumeId: dataDiskId })
        assert.ok(dataVolume, "Data disk should exist in Scaleway")
        const dataVolumeId = extractId(dataVolume.id || '')
        assert.strictEqual(dataVolumeId, dataDiskId, "Data disk ID should match state output")

        // Verify root disk exists and ID matches state output
        assert.ok(state.provision.output?.rootDiskId, "rootDiskId should be in output")
        const rootDiskId = extractId(state.provision.output.rootDiskId)
        const rootVolume = await scalewayClient.getVolume({ zone: zone, volumeId: rootDiskId })
        assert.ok(rootVolume, "Root disk should exist in Scaleway")
        const rootVolumeId = extractId(rootVolume.id || '')
        assert.strictEqual(rootVolumeId, rootDiskId, "Root disk ID should match state output")

        // Verify base image exists and ID matches state output
        assert.ok(state.provision.output?.baseImageId, "baseImageId should be in output")
        const baseImageId = extractId(state.provision.output.baseImageId)
        const image = await scalewayClient.getImage({ zone: zone, imageId: baseImageId })
        assert.ok(image, "Base image should exist in Scaleway")
        const imageId = extractId(image.id || '')
        assert.strictEqual(imageId, baseImageId, "Base image ID should match state output")

        // should have a FQDN as hostname
        const instanceHostname = state.provision.output?.host
        assert.ok(instanceHostname.endsWith(`.${dnsZone}`), `hostname should end with ${dnsZone}`)

        // should have a DNS A record pointing to instance public IP
        // matching our inputs
        const instanceIp = state.provision.output?.publicIPv4
        assert.ok(instanceIp, "publicIPv4 should be in output")

        const scwClient = getScalewayClient()
        const records = await scwClient.listDnsZoneRecords(dnsZone)

        logger.info(`DNS records for zone ${dnsZone}: ${JSON.stringify(records)}`)
        const instanceRecordName = instanceHostname.replace(`.${dnsZone}`, '')
        const aRecord = records.find(r => r.type === "A" && r.name === instanceRecordName)
        assert.ok(aRecord, `DNS A record for '${instanceHostname}' should exist after deploy`)
        assert.strictEqual(aRecord.data, instanceIp, `DNS record should point to instance IP ${instanceIp}`)
        assert.strictEqual(aRecord.name, dnsRecordName, `DNS record name should be ${dnsRecordName}`)
    
    }).timeout(10000)

    it('should verify instance configuration after deployment', async () => {
        await runVerify({ createDataDiskTestFile: true, skipRatelimitVerify: true })
    }).timeout(5*60*1000) // 5 minutes timeout

    it('should update instance', async () => {
        const instanceUpdater = scalewayProviderClient.getInstanceUpdater()
        await instanceUpdater.updateStateOnly({
            instanceName: instanceName,
            provisionInputs: {
                // update instance type and disk size
                instanceType: "L40S-1-48G",
                dataDiskSizeGb: 55,
            }, 
        })

        const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
        await instanceManager.deploy()

        const scalewayClient = getScalewayClient()
        const state = await getCurrentTestState()

        assert.ok(state.provision.output?.instanceServerId)
        currentInstanceServerId = state.provision.output.instanceServerId

        const serverData = await scalewayClient.getRawServerData(currentInstanceServerId)
        assert.strictEqual(serverData?.commercialType, "L40S-1-48G")

        const dataDiskId = state.provision.output?.machineDataDiskLookupId
        assert.ok(dataDiskId)

        const volume = await scalewayClient.getVolume({ zone: zone, volumeId: dataDiskId })
        assert.strictEqual(String(volume?.size).substring(0, 2), "55")

    }).timeout(20*60*1000) // 20 minutes timeout

    it('should have a valid instance server output with existing server', async () => {
        const state = await getCurrentTestState()
        
        assert.ok(state.provision.output?.instanceServerId)
        currentInstanceServerId = state.provision.output.instanceServerId

        const scalewayClient = getScalewayClient()
        
        const serverStatus = await scalewayClient.getInstanceStatus(currentInstanceServerId)
        assert.strictEqual(serverStatus, ScalewayServerState.Running)
    }).timeout(10000)

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
            await instanceManager.stop({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.configured, false)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown)

            const state = await getCurrentTestState()
            assert.strictEqual(state.provision.output?.instanceServerId, undefined, "instanceServerId should be undefined after stop")
            assert.strictEqual(state.provision.output?.dataDiskId, undefined, "dataDiskId should be undefined after stop")
            assert.ok(state.provision.output?.dataDiskSnapshotId, "dataDiskSnapshotId should be in output after stop")

            // host should still be the FQDN after stop
            assert.strictEqual(state.provision.output?.host, `${dnsRecordName}.${dnsZone}`, "host should be FQDN after stop")

            // DNS A record should persist but point to TEST-NET while server is gone
            const scwClient = getScalewayClient()
            const records = await scwClient.listDnsZoneRecords(dnsZone)
            assert.ok(records.length > 0, `DNS A record '${dnsRecordName}.${dnsZone}' should still exist after stop`)
            const aRecord = records.find(r => r.type === "A")
            assert.ok(aRecord, "DNS A record type should still exist after stop")
            assert.strictEqual(aRecord.data, "192.0.2.1", "DNS record should point to TEST-NET 192.0.2.1 while stopped")
        }).timeout(120000)
    }

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should start instance with re-provisioning (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
            await instanceManager.start({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.provisioned, true)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running)
            assert.strictEqual(instanceStatus.configured, true)

            const state = await getCurrentTestState()
            assert.ok(state.provision.output?.instanceServerId, "instanceServerId should exist after start")
            assert.ok(state.provision.output?.dataDiskId, "dataDiskId should exist after start")
            assert.ok(state.provision.output?.dataDiskSnapshotId, "dataDiskSnapshotId should exist after start")

            currentInstanceServerId = state.provision.output.instanceServerId

            // host should still be the FQDN after start
            const instanceIp = state.provision.output?.publicIPv4
            assert.ok(instanceIp, "publicIPv4 should be set after start")
            assert.strictEqual(state.provision.output?.host, `${dnsRecordName}.${dnsZone}`, "host should be FQDN after start")

            // DNS A record should point to the new real public IP
            const scwClient = getScalewayClient()
            const records = await scwClient.listDnsZoneRecords(dnsZone)
            logger.info(`DNS records after start for ${dnsRecordName}.${dnsZone}: ${JSON.stringify(records)}`)
            assert.ok(records.length > 0, `DNS A record '${dnsRecordName}.${dnsZone}' should exist after start`)
            const aRecord = records.find(r => r.type === "A")
            assert.ok(aRecord, "DNS A record type should exist after start")
            assert.strictEqual(aRecord.data, instanceIp, `DNS record should point to instance IP ${instanceIp} after start`)
            assert.strictEqual(aRecord.name, dnsRecordName, `DNS record name should be ${dnsRecordName} after start`)
        }).timeout(120000)
    }

    it('should wait for instance readiness', async () => {
        if(process.env.CLOUDYPAD_SKIP_CONFIGURATION === "true"){
            logger.warn("CLOUDYPAD_SKIP_CONFIGURATION is set - skipping instance readiness check")
            return
        }

        const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
        
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
    }).timeout(5*60*1000) // 5 minutes timeout

    it('should restart instance without deleting or re-provisioning', async () => {

        const stateBefore = await getCurrentTestState()
        const serverIdBefore = stateBefore.provision.output?.instanceServerId

        assert.ok(serverIdBefore)

        const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
        await instanceManager.restart({ wait: true })

        const stateAfter = await getCurrentTestState()
        assert.strictEqual(stateAfter.provision.output?.instanceServerId, serverIdBefore)
    }).timeout(120000)

    it('should destroy instance', async () => {
        const instanceManager = await scalewayProviderClient.getInstanceManager(instanceName)
        await instanceManager.destroy()
    }).timeout(120000)

    it('instance does not exist after destroy', async () => {
        const coreClient = new CloudypadClient({ config: coreConfig })
        const instances = await coreClient.getAllInstances()
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined)
    })
    

}).timeout(360000)
