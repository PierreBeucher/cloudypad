import { AwsPulumiClient } from "../../../src/providers/aws/pulumi"
import { AzurePulumiClient } from "../../../src/providers/azure/pulumi";
import { InstancePulumiClient } from "../../../src/tools/pulumi/client";
import { GcpPulumiClient } from "../../../src/providers/gcp/pulumi";
import { awsInput, azureInput, gcpInput, scalewayInput } from "./test-config.spec"
import { ScalewayPulumiClient } from "../../../src/providers/scaleway/pulumi";

/**
 * Test using real deployment our stack behave properly, especially for Spot / non-Spot config
 * which may cause unexpected bugs
 */
describe('Test Pulumi up', function() {

    // Pulumi is expected to take a few minutes to run
    // Especially for AWS which takes a long time to stop/delete instances
    this.timeout(15*60*1000);

    async function upThenDestroy<C extends Object, O>(client: InstancePulumiClient<C, O>, input: C){
        
        await client.setConfig(input)
        const upRes = await client.up()
        console.info(`Pulumi ${client.stackName} result: ${JSON.stringify(upRes)}`)

        const destroyRes = await client.destroy()
        console.info(`Pulumi ${client.stackName} destroy result: ${JSON.stringify(destroyRes)}`)
    }

    // it('should create/destroy AWS stack without errors', async () => {
    //     const client = new AwsPulumiClient("cloudypad-pulumi-aws-test")
    //     await upThenDestroy(client, awsInput)
    // })

    // it('should create/destroy AWS stack with Spot without errors', async () => {
    //     const client = new AwsPulumiClient("cloudypad-pulumi-aws-spot-test")
    //     await upThenDestroy(client, { ...awsInput, useSpot: true})
    // })

    // it('should create/destroy Azure stack without errors', async () => {
    //     const client = new AzurePulumiClient("cloudypad-pulumi-azure-test")
    //     await upThenDestroy(client, azureInput)
    // })

    // it('should create/destroy Azure Spot stack without errors', async () => {
    //     const client = new AzurePulumiClient("cloudypad-pulumi-azure-spot-test")
    //     await upThenDestroy(client, { ...azureInput, useSpot: true})
    // })

    // it('should create/destroy GCP stack without errors', async () => {
    //     const client = new GcpPulumiClient("cloudypad-pulumi-gcp-test")
    //     await upThenDestroy(client, gcpInput)
    // })

    // it('should create/destroy GCP Spot stack without errors', async () => {
    //     const client = new GcpPulumiClient("cloudypad-pulumi-gcp-spot-test")
    //     await upThenDestroy(client, { ...gcpInput, useSpot: true })
    // })

    it('should create/destroy Scaleway stack without errors', async () => {
        const client = new ScalewayPulumiClient({
            stackName: "cloudypad-pulumi-scaleway-test",
            workspaceOptions: {} // use local config
        })
        await upThenDestroy(client, scalewayInput)
    })
})
