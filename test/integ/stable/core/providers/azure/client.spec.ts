import * as assert from 'assert'
import { AzureClient, AzureVmStatus } from '../../../../../../src/providers/azure/sdk-client'
import { AZURE_SUPPORTED_GPU } from '../../../../../../src/providers/azure/cli'

describe('AzureClient', () => {
    let client = new AzureClient('AzureClientTest', "0dceb5ed-9096-4db7-b430-2609e7cc6a15")
    
    describe('getQuota', () => {
        it('should return quota standardNDSFamily without error', async () => {
            const quota = await client.getComputeQuota("standardNDSFamily", "francecentral")
            assert.equal(quota !== undefined && quota >= 0, true)
        }).timeout(10000)

        it('should return quota lowPriorityCores without error', async () => {
            const quota = await client.getComputeQuota("lowPriorityCores", "francecentral")
            assert.equal(quota !== undefined && quota >= 0, true)
        }).timeout(10000)
        
        it('should find quota for all supported GPU types', async () => {
            const allQuotas = new Set(AZURE_SUPPORTED_GPU.map(gpuType => gpuType.quotaName))

            for(const quota of allQuotas) {
                console.info(`Getting quota ${quota}`)
                const quotaValue = await client.getComputeQuota(quota, "francecentral")
                assert.equal(quotaValue !== undefined && quotaValue >= 0, true)
            }
        }).timeout(60000)
    })

    describe('listMachineSizes', () => {
        it('should return list of machine sizes without error', async () => {
            const sizes = await client.listMachineSizes("francecentral")
            assert.equal(sizes.length > 0, true)
        }).timeout(60000)
    })

    // don't test instance-specific methods as they are indirectly tested by lifecycle tests
    // describe('getInstanceStatus', () => {
    //     it('should return instance status without error', async () => {
    //         const status = await client.getInstanceStatus("test-deleteme_group", "test-deleteme")
    //         assert.equal(status, AzureVmStatus.Deallocated)
    //     }).timeout(60000)
    // })

    describe('listLocations', () => {
        it('should return a list of locations without error', async () => {
            const locations = await client.listLocations()
            assert.equal(locations.length > 0, true)
            assert.equal(locations.some(location => location.name === "francecentral"), true)
        }).timeout(60000)
    })

    describe('listInstances', () => {
        it('should return a list of virtual machines without error', async () => {
            const vms = await client.listInstances()
            // no error is enough as there may not be any instance
            // assert.equal(vms.length > 0, true)
        }).timeout(60000)
    })
})