import * as assert from 'assert'
import { LinodeClient } from '../../../../../../src/providers/linode/sdk-client'
import { getLogger } from '../../../../../../src/log/utils'
import { Linode } from '@linode/api-v4'

describe('Linode Client', () => {
    const logger = getLogger("test-linode-client")
    
    // Linode test configuration
    const region = "fr-par"

    let createdInstance: Linode | undefined

    function getLinodeClient(): LinodeClient {    
        return new LinodeClient({
            region: region,
        })
    }

    it('should handle authentication check', async () => {
        const linodeClient = getLinodeClient()
        await linodeClient.checkAuth() // throws if authentication fails
    })

    it('should list available regions', async () => {
        const linodeClient = getLinodeClient()
        const regions = await linodeClient.listRegions()
        
        assert.ok(Array.isArray(regions))
        assert.ok(regions.length > 0)
        
        assert.ok(regions.includes(region))
    })

    it('should list instance types', async () => {
        const linodeClient = getLinodeClient()
        const instanceTypes = await linodeClient.listInstanceTypes()
        
        assert.ok(instanceTypes.length > 0)
        
        // Verify common instance types exist
        const nanode = instanceTypes.find(type => type.id === 'g6-nanode-1')
        assert.ok(nanode)
    })

    it('should create instance', async () => {
        const linodeClient = getLinodeClient()
        createdInstance = await linodeClient.createInstance({
            region: region,
            type: 'g6-nanode-1',
            image: 'linode/ubuntu22.04',
            label: 'test-instance-linode-client',
        })
    })

    it('should list instances and find created instance', async () => {

        const checkInstance = createdInstance
        assert.ok(checkInstance) // requires an instance to check it's listed

        const linodeClient = getLinodeClient()
        const instances = await linodeClient.listInstances()
        assert.ok(instances.length > 0)

        const instance = instances.find(instance => instance.id === checkInstance.id)
        assert.ok(instance)
    })

    it('should get instance details', async () => {
        assert.ok(createdInstance)
        
        const linodeClient = getLinodeClient()
        const instance = await linodeClient.getLinode(createdInstance.id)
        assert.equal(instance?.status, 'running')
    })

    it('should delete instance', async () => {
        assert.ok(createdInstance)
        
        const linodeClient = getLinodeClient()
        await linodeClient.deleteInstance(createdInstance.id)
        assert.ok(!createdInstance)
    })

}).timeout(120000) 