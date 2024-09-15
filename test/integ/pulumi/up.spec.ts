import { AwsPulumiClient } from "../../../src/tools/pulumi/aws"
import { AzurePulumiClient } from "../../../src/tools/pulumi/azure";
import { InstancePulumiClient } from "../../../src/tools/pulumi/client";
import { GcpPulumiClient } from "../../../src/tools/pulumi/gcp";
import { awsConfig, azureConfig, gcpConfig } from "./test-config.spec"

/**
 * Test using real deployment our stack behave properly, especially for Spot / non-Spot config
 * which may cause unexpected bugs
 */
describe('Test Pulumi up', function() {

    // Pulumi is expected to take a few minutes to run
    // Especially for AWS which takes a long time to stop/delete instances
    this.timeout(15*60*1000);

    async function upThenDestroy<C, O>(client: InstancePulumiClient<C, O>, config: C){
        
        await client.setConfig(config)
        const upRes = await client.up()
        console.info(`Pulumi ${client.stackName} result: ${JSON.stringify(upRes)}`)

        const destroyRes = await client.destroy()
        console.info(`Pulumi ${client.stackName} destroy result: ${JSON.stringify(destroyRes)}`)
    }

    it('should create/destroy AWS stack without errors', async () => {
        const client = new AwsPulumiClient("cloudypad-pulumi-aws-test")
        await upThenDestroy(client, awsConfig)
    })

    it('should create/destroy AWS stack with Spot without errors', async () => {
        const client = new AwsPulumiClient("cloudypad-pulumi-aws-spot-test")
        await upThenDestroy(client, { ...awsConfig, useSpot: true})
    })

    it('should create/destroy Azure stack without errors', async () => {
        const client = new AzurePulumiClient("cloudypad-pulumi-azure-test")
        await upThenDestroy(client, azureConfig)
    })

    it('should create/destroy Azure Spot stack without errors', async () => {
        const client = new AzurePulumiClient("cloudypad-pulumi-azure-spot-test")
        await upThenDestroy(client, { ...azureConfig, useSpot: true})
    })

    it('should create/destroy GCP stack without errors', async () => {
        const client = new GcpPulumiClient("cloudypad-pulumi-gcp-test")
        await upThenDestroy(client, gcpConfig)
    })

    it('should create/destroy GCP Spot stack without errors', async () => {
        const client = new GcpPulumiClient("cloudypad-pulumi-gcp-spot-test")
        await upThenDestroy(client, { ...gcpConfig, useSpot: true })
    })
})