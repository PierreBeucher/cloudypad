import * as assert from 'assert'
import { ScalewayClient, ScalewayServerState } from '../../../src/tools/scaleway'
import { ScalewayInstanceStateV1, ScalewayStateParser } from '../../../src/providers/scaleway/state'
import { getIntegTestCoreClient, getIntegTestCoreConfig } from '../utils'
import { ScalewayProviderClient } from '../../../src/providers/scaleway/provider'
import { ServerRunningStatus } from '../../../src/core/runner'
import { getLogger } from '../../../src/log/utils'

// This test is run manually using an existing instance

describe('Scaleway lifecycle with instance server deletion', () => {
    const logger = getLogger("test-scaleway-lifecycle-with-server-deletion")
    const coreConfig = getIntegTestCoreConfig()
    const coreClient = getIntegTestCoreClient()
    const instanceName = 'test-instance-scaleway-lifecycle-with-server-deletion'

    const projectId = "297ea06f-4231-4ee7-bd5e-cb28cec4c4ee"
    const region = "fr-par"
    const zone = "fr-par-2"

    let currentInstanceServerId: string | undefined = undefined

    async function getCurrentState(): Promise<ScalewayInstanceStateV1> {
        // Not practical... TODO
        const stateLoader = coreClient.buildStateLoader()
        const rawState = await stateLoader.loadInstanceState(instanceName)
        const state = new ScalewayStateParser().parse(rawState)
        return state
    }

    function getScalewayClient(): ScalewayClient {    
        return new ScalewayClient("test-scaleway-lifecycle-with-server-deletion", {
            projectId: projectId,
            region: region,
            zone: zone,
        })
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
                deleteInstanceServerOnStop: true,
                imageId: "0dc5f115-4256-44c1-ae8c-681fc534a40e"
            }, {
                sunshine: {
                    enable: true,
                    username: "sunshine",
                    passwordBase64: Buffer.from("Sunshine!").toString('base64')
                }, 
                ansible: {
                    additionalArgs: "-t data-disk,sunshine"
                }
            })
    })

    it('should deploy instance', async () => {
        const instanceManager = await coreClient.buildInstanceManager(instanceName)
        await instanceManager.deploy()
    }).timeout(360000)

    it('should have a valid instance server output with existing server', async () => {
        const state = await getCurrentState()
        
        assert.ok(state.provision.output?.instanceServerId)
        currentInstanceServerId = state.provision.output.instanceServerId

        const scalewayClient = getScalewayClient()
        
        const serverStatus = await scalewayClient.getInstanceStatus(currentInstanceServerId)
        assert.strictEqual(serverStatus, ScalewayServerState.Running)
    }).timeout(10000)

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should stop instance and delete instance server (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await coreClient.buildInstanceManager(instanceName)
            await instanceManager.stop({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.configured, false)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Unknown)

            const state = await getCurrentState()
            assert.strictEqual(state.provision.output?.instanceServerId, undefined)

            const scalewayClient = getScalewayClient()
            const instances = await scalewayClient.listInstances()
            const instance = instances.find(instance => instance.id === currentInstanceServerId)
            assert.strictEqual(instance, undefined)

            currentInstanceServerId = undefined
        }).timeout(120000)
    }

    // run twice for idempotency
    for (let i = 0; i < 2; i++) { 

        it(`should start instance with re-provisioning (${i+1}/2 for idempotency)`, async () => {
            const instanceManager = await coreClient.buildInstanceManager(instanceName)
            await instanceManager.start({ wait: true })

            const instanceStatus = await instanceManager.getInstanceStatus()
            assert.strictEqual(instanceStatus.configured, true)
            assert.strictEqual(instanceStatus.provisioned, true)
            assert.strictEqual(instanceStatus.serverStatus, ServerRunningStatus.Running)

            const state = await getCurrentState()
            assert.ok(state.provision.output?.instanceServerId)

            currentInstanceServerId = state.provision.output.instanceServerId
        }).timeout(120000)
    }

    it('should wait for instance readiness', async () => {
        const instanceManager = await coreClient.buildInstanceManager(instanceName)
        
        let isReady = false
        for (let attempt = 0; attempt < 60; attempt++) {
            isReady = await instanceManager.isReady()
            if (isReady) break
            logger.info(`Waiting for instance readiness... ${attempt + 1} / 60`)
            await new Promise(resolve => setTimeout(resolve, 5000)) // wait for 5 seconds before retrying
        }
        assert.strictEqual(isReady, true)

    }).timeout(120000)

    it('should restart instance without deleting or re-provisioning', async () => {

        const stateBefore = await getCurrentState()
        const serverIdBefore = stateBefore.provision.output?.instanceServerId

        assert.ok(serverIdBefore)

        const instanceManager = await coreClient.buildInstanceManager(instanceName)
        await instanceManager.restart({ wait: true })

        const stateAfter = await getCurrentState()
        assert.strictEqual(stateAfter.provision.output?.instanceServerId, serverIdBefore)
    }).timeout(120000)

    it('should destroy instance', async () => {
        const instanceManager = await coreClient.buildInstanceManager(instanceName)
        await instanceManager.destroy()
    }).timeout(120000)

    it('instance does not exist after destroy', async () => {
        const instances = await coreClient.getAllInstances()
        assert.strictEqual(instances.find(instance => instance === instanceName), undefined)
    })
    

}).timeout(360000)