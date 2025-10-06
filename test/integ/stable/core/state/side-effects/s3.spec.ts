import * as assert from 'assert'
import * as yaml from 'yaml'
import { S3Client, GetObjectCommand, PutObjectCommand, S3ClientConfig } from '@aws-sdk/client-s3'
import { S3StateSideEffect } from '../../../../../../src/core/state/side-effects/s3'
import { InstanceStateV1 } from '../../../../../../src/core/state/state'
import Docker from 'dockerode'
import { getLogger } from '../../../../../../src/log/utils'

describe('S3StateSideEffect', () => {
    
    const logger = getLogger("S3StateSideEffect-integ-test")

    // always create a new bucket for each test run to avoid conflicts
    const testBucketName = `cloudypad`

    const s3ClientConfig: S3ClientConfig = {
        endpoint: 'http://localhost:9010',
        region: 'eu-east-1',
        credentials: {
            accessKeyId: 'cloudypad',
            secretAccessKey: 'cloudypad',
        }
    }

    // test client to check data after persistence
    const s3Client = new S3Client(s3ClientConfig)

    // S3StateSideEffect to be tested
    const s3StateSideEffect = new S3StateSideEffect({ 
        bucketName: testBucketName,

        // Use MinIO container
        s3ClientConfig: s3ClientConfig
    })

    const dummyInstance1 = 'dummy-instance-1'
    const dummyInstance2 = 'dummy-instance-2'

    const dummyState1 = createDummyState(dummyInstance1)
    const dummyState2 = createDummyState(dummyInstance2)

    function createDummyState(name: string): InstanceStateV1 {
        return {
            name: name,
            version: '1',
            provision: { 
                provider: 'test', 
                input: { ssh: { user: 'test', privateKeyPath: 'test' } } 
            },
            configuration: { 
                configurator: "ansible",
                input: {}
            }
        }
    }

    it('should list instances (empty)', async () => {
        const instances = await s3StateSideEffect.listInstances()
        assert.strictEqual(instances.length, 0)
    })

    it('should check if instance exists (non-existent)', async () => {
        const exists = await s3StateSideEffect.instanceExists(dummyInstance1)
        assert.strictEqual(exists, false)
    })

    it('should persist and load state', async () => {
        await s3StateSideEffect.persistState(dummyState1)
        
        // check state persisted
        const params = {
            Bucket: testBucketName,
            Key: `instances/${dummyInstance1}/state.yml`
        }
        const data = await s3Client.send(new GetObjectCommand(params))
        const body = await data.Body?.transformToString()
        assert.strictEqual(body, yaml.stringify(dummyState1))

        // check state can be loaded
        const loadedState = await s3StateSideEffect.loadRawInstanceState(dummyInstance1)
        assert.deepEqual(loadedState, dummyState1)
    })

    it('should list instances', async () => {

        // create an unrelated file to ensure it won't be listed
        const params = {
            Bucket: testBucketName,
            Key: `instances/foo.yml`,
            Body: "bar",
        }
        await s3Client.send(new PutObjectCommand(params))

        // list instances and check
        const instances = await s3StateSideEffect.listInstances()
        assert.strictEqual(instances.length, 1)
        assert.strictEqual(instances[0], dummyInstance1)

        // persist another state and check again
        await s3StateSideEffect.persistState(dummyState2)
        
        const instances2 = await s3StateSideEffect.listInstances()
        assert.strictEqual(instances2.length, 2)
        assert.strictEqual(instances2[0], dummyInstance1)
        assert.strictEqual(instances2[1], dummyInstance2)
    })

    it('should check if instance exists', async () => {
        const exists = await s3StateSideEffect.instanceExists(dummyInstance1)
        assert.strictEqual(exists, true)
    })

    it('should destroy state', async () => {
        await s3StateSideEffect.destroyState(dummyInstance1)
        const exists = await s3StateSideEffect.instanceExists(dummyInstance1)
        assert.strictEqual(exists, false)
    })
}).timeout(35000)