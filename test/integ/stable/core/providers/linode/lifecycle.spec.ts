import * as assert from 'assert'
import { LinodeClient } from '../../../../../../src/providers/linode/sdk-client'
import { LinodeInstanceStateV1 } from '../../../../../../src/providers/linode/state'
import { getIntegTestCoreConfig } from '../../../../utils'
import { LinodeProviderClient } from '../../../../../../src/providers/linode/provider'
import { ServerRunningStatus } from '../../../../../../src/core/runner'
import { getLogger } from '../../../../../../src/log/utils'
import { CloudypadClient } from '../../../../../../src/core/client'

// This test is run manually using an existing instance

describe('Linode lifecycle', () => {
    const logger = getLogger("test-linode-lifecycle")
    const coreConfig = getIntegTestCoreConfig()
    const linodeProviderClient = new LinodeProviderClient({ config: coreConfig })
    const instanceName = 'test-instance-linode-lifecycle-from-image'

    // Linode test configuration
    const region = "fr-par"
    const instanceType = "g2-gpu-rtx4000a1-s"
    const rootDiskSizeGb = 25
    const dataDiskSizeGb = 10

    let currentInstanceServerId: string | undefined = undefined

    async function getCurrentTestState(): Promise<LinodeInstanceStateV1> {
        return linodeProviderClient.getInstanceState(instanceName)
    }

    function getLinodeClient(): LinodeClient {    
        return new LinodeClient({
            region: region,
        })
    }
    
    it('should initialize instance state', async () => {

        assert.strictEqual(currentInstanceServerId, undefined)

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
                imageId: "linode/ubuntu24.04",
                watchdogEnabled: true, // need to have watchdog otherwise Ansible reboot during config will effectively shutdown instance
                dns: {
                    domainName: "green.instances.cloudypad.gg",
                },
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
        currentInstanceServerId = state.provision.output.instanceServerId

        // Verify the instance was created with correct specifications
        const linodeClient = getLinodeClient()
        await linodeClient.checkAuth()
        const instanceDetails = await linodeClient.getLinode(currentInstanceServerId)
        assert.ok(instanceDetails, 'Instance details should be available')
        assert.strictEqual(instanceDetails.type, instanceType)
    }).timeout(20*60*1000) // 20 minutes timeout

    // it('should update instance', async () => {
    //     const instanceUpdater = linodeProviderClient.getInstanceUpdater()
    //     await instanceUpdater.updateStateOnly({
    //         instanceName: instanceName,
    //         provisionInputs: {
    //             instanceType: "g6-standard-1", // Upgrade to a larger instance
    //         }, 
    //     })

    //     const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
    //     await instanceManager.deploy()

    //     const linodeClient = getLinodeClient()
    //     const state = await getCurrentTestState()

    //     assert.ok(state.provision.output?.instanceServerId)
    //     currentInstanceServerId = state.provision.output.instanceServerId

    //     const instanceDetails = await linodeClient.getLinode(currentInstanceServerId)
    //     assert.ok(instanceDetails, 'Instance details should be available after update')
    //     assert.strictEqual(instanceDetails.type, "g6-standard-1")

    // }).timeout(20*60*1000) // 20 minutes timeout

    // it('should have a valid instance server output with existing server', async () => {
    //     const state = await getCurrentTestState()
        
    //     assert.ok(state.provision.output?.instanceServerId)
    //     currentInstanceServerId = state.provision.output.instanceServerId

    //     const linodeClient = getLinodeClient()
        
    //     const serverStatus = await linodeClient.getInstanceStatus(currentInstanceServerId)
    //     // Instance should be in a valid state (running, stopped, etc.)
    //     assert.equal(serverStatus, 'running')
    // }).timeout(10000)

    // // run twice for idempotency
    // for (let i = 0; i < 2; i++) { 

    //     it(`should stop instance and keep instance server (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
    //         await instanceManager.stop({ wait: true })

    //         const instanceStatus = await instanceManager.getInstanceStatus()
    //         assert.strictEqual(instanceStatus.configured, false)
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown)

    //         const state = await getCurrentTestState()
    //         assert.strictEqual(state.provision.output?.instanceServerId, currentInstanceServerId)

    //         // instance should be deleted on stop
    //         const linodeClient = getLinodeClient()
    //         const instances = await linodeClient.listInstances()
    //         const instance = instances.find((instance) => instance.id.toString() === currentInstanceServerId)
    //         assert.ok(!instance)
    //     }).timeout(120000)
    // }

    // // run twice for idempotency
    // for (let i = 0; i < 1; i++) {  // TODO 2

    //     it(`should start instance with re-provisioning (${i+1}/2 for idempotency)`, async () => {
    //         const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
    //         await instanceManager.start({ wait: true })

    //         const instanceStatus = await instanceManager.getInstanceStatus()
    //         assert.strictEqual(instanceStatus.configured, true)
    //         assert.strictEqual(instanceStatus.provisioned, true)
    //         assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running)

    //         const state = await getCurrentTestState()
    //         assert.ok(state.provision.output?.instanceServerId)

    //         currentInstanceServerId = state.provision.output.instanceServerId
    //     }).timeout(1200000) // 20 minutes timeout
    // }

    // it('should wait for instance readiness', async () => {
    //     const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
        
    //     let isReady = false
    //     for (let attempt = 0; attempt < 60; attempt++) {
    //         isReady = await instanceManager.isReady()
    //         if (isReady) break
    //         logger.info(`Waiting for instance readiness... ${attempt + 1} / 60`)
    //         await new Promise(resolve => setTimeout(resolve, 5000)) // wait for 5 seconds before retrying
    //     }
    //     assert.strictEqual(isReady, true)

    // }).timeout(120000)

    // it('should restart instance without deleting or re-provisioning', async () => {

    //     const stateBefore = await getCurrentTestState()
    //     const serverIdBefore = stateBefore.provision.output?.instanceServerId

    //     assert.ok(serverIdBefore)

    //     const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
    //     await instanceManager.restart({ wait: true })

    //     const stateAfter = await getCurrentTestState()
    //     assert.strictEqual(stateAfter.provision.output?.instanceServerId, serverIdBefore)
    // }).timeout(120000)

    // it('should destroy instance', async () => {
    //     const instanceManager = await linodeProviderClient.getInstanceManager(instanceName)
    //     await instanceManager.destroy()
    // }).timeout(120000)

    // it('instance does not exist after destroy', async () => {
    //     const coreClient = new CloudypadClient({ config: coreConfig })
    //     const instances = await coreClient.getAllInstances()
    //     assert.strictEqual(instances.find(instance => instance === instanceName), undefined)
    // })
    

}).timeout(360000) 