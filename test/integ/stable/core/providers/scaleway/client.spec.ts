import * as assert from 'assert'
import { ScalewayClient, ScalewayServerState } from '../../../../src/providers/scaleway/sdk-client'

// This test is run manually using an existing instance

describe('ScalewayClient', () => {
    const client = new ScalewayClient('ScalewayClientTest', {
        projectId: "544ba1fc-29c6-4c3f-9a1a-2531ef7593ba",
        region: "fr-par",
        zone: "fr-par-2",
    })
    
    describe('listRegions', () => {
        it('should return list of regions without error', async () => {
            const regions = ScalewayClient.listRegions()
            console.info(`Regions: ${JSON.stringify(regions)}`)

            assert.equal(regions.length > 0, true)
            assert.equal(regions.find(r => r == "fr-par"), "fr-par")
        }).timeout(10000)
    })

    describe('listZones', () => {
        it('should return list of zones without error', async () => {
            const zones = ScalewayClient.listZones()
            console.info(`Zones: ${JSON.stringify(zones)}`)
            
            assert.equal(zones.length > 0, true)
            assert.equal(zones.find(z => z == "fr-par-2"), "fr-par-2")
        }).timeout(10000)
    })

    describe('listProjects', () => {
        it('should return list of projects without error', async () => {
            const projects = await client.listProjects()
            console.info(`Projects: ${JSON.stringify(projects)}`)
            assert.equal(projects.length > 0, true)
        }).timeout(10000)
    })

    describe('listInstanceImages', () => {
        it('should return list of instance images without error', async () => {
            const images = await client.listInstanceImages()
            console.info(`Images: ${JSON.stringify(images)}`)
            assert.equal(images.length > 0, true)
        }).timeout(10000)
    })

    describe('listInstances', () => {
        it('should return list of instances without error', async () => {
            const instances = await client.listInstances()
            
            console.info(`Instances: ${JSON.stringify(instances)}`)
        }).timeout(10000)
    })

    describe('listGpuServerTypes', () => {
        it('should return list of gpu server types without error', async () => {
            const gpuServerTypes = await client.listGpuInstanceTypes(1)
            console.info(`Gpu Server Types: ${JSON.stringify(gpuServerTypes)}`)
            assert.equal(gpuServerTypes.length > 0, true)
        }).timeout(10000)
    })

    // do not test instance-specific methods as they are indirectly tested by lifecycle tests
    
    // describe('getInstanceStatus', () => {
    //     it('should return instance status without error', async () => {
    //         const status = await client.getInstanceStatus(instanceServerId)

    //         console.info(`Instance status: ${status}`)

    //         assert.equal(status, ScalewayServerState.Stopped)
    //     }).timeout(10000)
    // })

    // describe('startInstance', () => {
    //     it('should start instance without error', async () => {
    //         await client.startInstance(instanceServerId, { wait: true })
    //         const status = await client.getInstanceStatus(instanceServerId)
    //         assert.equal(status, ScalewayServerState.Running)
    //     }).timeout(60000)
    // })

    // describe('restartInstance', () => {
    //     it('should restart instance without error', async () => {
    //         await client.restartInstance(instanceServerId, { wait: true })
    //         const status = await client.getInstanceStatus(instanceServerId)
    //         assert.equal(status, ScalewayServerState.Running)
    //     }).timeout(60000)
    // })

    // describe('stopInstance', () => {
    //     it('should stop instance without error', async () => {
    //         await client.stopInstance(instanceServerId, { wait: true })
    //         const status = await client.getInstanceStatus(instanceServerId)
    //         assert.equal(status, ScalewayServerState.Stopped)
    //     }).timeout(60000)
    // })
})