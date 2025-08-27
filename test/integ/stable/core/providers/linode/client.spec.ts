// import * as assert from 'assert'
// import { LinodeClient } from '../../../../../../src/providers/linode/sdk-client'
// import { getLogger } from '../../../../../../src/log/utils'

// // This test verifies basic Linode client functionality

// describe('Linode Client', () => {
//     const logger = getLogger("test-linode-client")
    
//     // Linode test configuration
//     const region = "us-central"
//     const instanceName = 'test-linode-client'

//     function getLinodeClient(): LinodeClient {    
//         return new LinodeClient(instanceName, {
//             region: region,
//         })
//     }

//     it('should list available regions', async () => {
//         const regions = await LinodeClient.listRegions()
        
//         assert.ok(Array.isArray(regions))
//         assert.ok(regions.length > 0)
        
//         // Verify our test region exists
//         assert.ok(regions.includes(region))
        
//         logger.info(`Found ${regions.length} Linode regions`)
//         logger.debug(`Available regions: ${regions.join(', ')}`)
//     }).timeout(30000)

//     it('should list instance types', async () => {
//         const instanceTypes = await LinodeClient.listInstanceTypes()
        
//         assert.ok(Array.isArray(instanceTypes))
//         assert.ok(instanceTypes.length > 0)
        
//         // Verify some common instance types exist
//         const nanode = instanceTypes.find(type => type.id === 'g6-nanode-1')
//         const standard = instanceTypes.find(type => type.id === 'g6-standard-1')
        
//         assert.ok(nanode)
//         assert.ok(standard)
        
//         logger.info(`Found ${instanceTypes.length} Linode instance types`)
//         logger.debug(`Nanode type: ${JSON.stringify(nanode)}`)
//         logger.debug(`Standard type: ${JSON.stringify(standard)}`)
//     }).timeout(30000)

//     it('should list instances (empty list for clean account)', async () => {
//         const linodeClient = getLinodeClient()
//         const instances = await linodeClient.listInstances()
        
//         assert.ok(Array.isArray(instances))
        
//         logger.info(`Found ${instances.length} existing Linode instances`)
        
//         // Log instance details if any exist
//         instances.forEach(instance => {
//             logger.debug(`Instance: ${instance.label} (${instance.type}) - Status: ${instance.status}`)
//         })
//     }).timeout(30000)

//     it('should handle authentication check', async () => {
//         // This test verifies that the LINODE_TOKEN environment variable is set
//         // and that we can make authenticated API calls
        
//         try {
//             const regions = await LinodeClient.listRegions()
//             assert.ok(regions.length > 0)
//             logger.info('Linode authentication successful')
//         } catch (error) {
//             if (error instanceof Error && error.message.includes('Authentication')) {
//                 throw new Error('Linode authentication failed. Please check LINODE_TOKEN environment variable.')
//             }
//             throw error
//         }
//     }).timeout(30000)

//     it('should handle invalid instance ID gracefully', async () => {
//         const linodeClient = getLinodeClient()
        
//         try {
//             await linodeClient.getInstanceStatus('999999') // Use a numeric string that's likely invalid
//             assert.fail('Should have thrown an error for invalid instance ID')
//         } catch (error) {
//             // Expected to fail with invalid ID
//             assert.ok(error instanceof Error)
//             logger.debug(`Expected error for invalid ID: ${error.message}`)
//         }
//     }).timeout(30000)

// }).timeout(120000) 