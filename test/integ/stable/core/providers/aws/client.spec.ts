import * as assert from 'assert';
import { AwsClient } from '../../../../../../src/providers/aws/sdk-client';
import { _InstanceType } from '@aws-sdk/client-ec2';
import { SUPPORTED_INSTANCE_TYPES } from '../../../../../../src/providers/aws/cli';
import { stringsToInstanceTypes } from '../../../../../../src/providers/aws/sdk-client';
describe('AWS Client Integration Tests', () => {
    
    it('should convert strings to instance types', async () => {
        const instanceTypes = stringsToInstanceTypes(["g5.xlarge", "g5.2xlarge", "g5.4xlarge"])
        assert.deepEqual(instanceTypes.sort(), [_InstanceType.g5_xlarge, _InstanceType.g5_2xlarge, _InstanceType.g5_4xlarge].sort())
    })

    it('should fail to convert invalid strings to instance types', async () => {
        await assert.rejects(async () => {
            stringsToInstanceTypes(["g5.xlarge", "g5.2xlarge", "g5.4xlarge", "invalid"])
        }, /Invalid instance type 'invalid', not recognized by AWS SDK/)
    })

    it('should filter available instance types', async () => {
        // eu-west-3 des not have g5 instances, they should not appear in the result
        const region = "eu-west-3"
        const awsClient = new AwsClient('integ-test', region)
        const instanceTypes = SUPPORTED_INSTANCE_TYPES

        const expectedInstanceTypes = instanceTypes.filter(instanceType => !instanceType.startsWith('g5'))
        const availableInstanceTypes = await awsClient.filterAvailableInstanceTypes(instanceTypes)

        console.info(`Found ${JSON.stringify(availableInstanceTypes)} available instance types in ${region}`)
        assert.deepEqual(availableInstanceTypes.sort(), expectedInstanceTypes.sort())
    })

    it('should fetch instance type details for supported instances in multiple regions without failing', async () => {

        const instanceTypes = SUPPORTED_INSTANCE_TYPES
        const regions = [ 
            "us-east-1",
            "eu-central-1",
            "eu-west-3",
        ]

        let result: { [ region: string]: _InstanceType[] } = {}
        const expected = {
            "eu-central-1": ["g4dn.2xlarge", "g4dn.4xlarge", "g4dn.xlarge", "g5.2xlarge", "g5.4xlarge", "g5.xlarge", "g5.8xlarge"].sort(),
            "eu-west-3": ["g4dn.2xlarge", "g4dn.4xlarge", "g4dn.xlarge"].sort(),
            "us-east-1": ["g4dn.2xlarge", "g4dn.4xlarge", "g4dn.xlarge", "g5.2xlarge", "g5.4xlarge", "g5.xlarge", "g5.8xlarge"].sort()
        }
        for(const region of regions){
            const awsClient = new AwsClient('integ-test', region)
            const availableInstanceTypes = await awsClient.filterAvailableInstanceTypes(instanceTypes)
            const instanceTypeDetails = await awsClient.getInstanceTypeDetails(availableInstanceTypes)
            console.info(`Found ${instanceTypeDetails.length} instance types in ${region}`)
            result[region] = instanceTypeDetails
                .filter(instanceType => instanceType.InstanceType !== undefined)
                .map(instanceType => instanceType.InstanceType!)
                .sort()
        }

        console.info(`Found ${JSON.stringify(result)} instance types in ${regions}`)
        assert.deepEqual(result, expected)
    }).timeout(60000)

    it('should fail to fetch instance type details for unsupported instance type', async () => {

        const instanceTypes = [_InstanceType.g5_4xlarge]
        const region = "eu-west-3"

        const awsClient = new AwsClient('integ-test', region)
        await assert.rejects(async () => {
            await awsClient.getInstanceTypeDetails(instanceTypes)
        }, /Failed to fetch instance details for instance type/)    
    }).timeout(60000)

    // don't test instance-specific methods as they are indirectly tested by lifecycle tests
    // it('should get instance state', async () => {
    //     const instanceId = 'i-08a558204090d96a7'
    //     const awsClient = new AwsClient('integ-test', 'eu-west-3')
    //     const state = await awsClient.getInstanceState(instanceId)
    //     assert.equal(state, 'stopped')
    // })
}) 
