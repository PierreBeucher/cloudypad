import * as assert from 'assert'
import { GcpClient, GcpInstanceStatus } from '../../../src/tools/gcp'

describe('GcpClient', () => {
    
    const client = new GcpClient("test-integ", "crafteo-sandbox")

    it('should get instance state', async () => {
        const state = await client.getInstanceState("europe-west4-b", "instance-20250205-160537")
        assert.equal(state, GcpInstanceStatus.Terminated)
    }).timeout(60000)
})