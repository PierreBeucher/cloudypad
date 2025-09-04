import * as assert from 'assert'
import * as crypto from 'crypto'
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
        const password = crypto.randomBytes(16).toString('base64')

        console.info(`Password: ${password}`)
        createdInstance = await linodeClient.createInstance({
            region: region,
            type: 'g6-nanode-1',
            rootPassword: password,
            image: 'linode/ubuntu22.04',
            label: 'test-instance-linode-client',
        })
    }).timeout(10000)

    it('should list instances and find created instance', async () => {

        const checkInstance = createdInstance
        assert.ok(checkInstance) // requires an instance to check it's listed

        const linodeClient = getLinodeClient()
        const instances = await linodeClient.listInstances()
        assert.ok(instances.length > 0)

        const instance = instances.find(instance => instance.id === checkInstance.id)
        assert.ok(instance)

        console.info(`Instance: ${JSON.stringify(instance)}`)
    })

    it('should get instance details', async () => {
        assert.ok(createdInstance)
        
        const linodeClient = getLinodeClient()
        const instance = await linodeClient.getLinode(createdInstance.id)
        assert.ok(instance?.status)
    })

    it('should delete instance', async () => {
        assert.ok(createdInstance)
        
        const linodeClient = getLinodeClient()
        await linodeClient.deleteInstance(createdInstance.id)
    }).timeout(10000)

}).timeout(120000) 