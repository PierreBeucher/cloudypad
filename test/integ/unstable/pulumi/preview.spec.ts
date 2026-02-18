import { AwsPulumiClient } from "../../../../src/providers/aws/pulumi/main";
import { AzurePulumiClient } from "../../../../src/providers/azure/pulumi/main";
import { InstancePulumiClient } from "../../../../src/tools/pulumi/client";
import { GcpPulumiClient } from "../../../../src/providers/gcp/pulumi/main";
import { awsInput, azureInput, gcpInput, scalewayInput } from "./test-config.spec"
import { ScalewayPulumiClient } from "../../../../src/providers/scaleway/pulumi/main";

describe('Test Pulumi preview', function() {

    // Pulumi is expected to take a few seconds, even minutes, to run
    this.timeout(5*60*1000); 

    async function preview<C extends Object, O>(client: InstancePulumiClient<C, O>, input: C){
        await client.setConfig(input)
        
        const previewRes = await client.preview()
        console.info(`Pulumi ${client.stackName} result: ${JSON.stringify(previewRes)}`)
    }

    // it('should preview AWS Pulumi stack without errors', async () => {
    //     const client = new AwsPulumiClient("cloudypad-pulumi-aws-test")
    //     await preview(client, awsInput)
    // })

    // it('should preview Azure Pulumi stack without errors', async () => {
    //     const client = new AzurePulumiClient("cloudypad-pulumi-azure-test")
    //     await preview(client, azureInput)
    // })

    // it('should preview GCP Pulumi stack without errors', async () => {
    //     const client = new GcpPulumiClient("cloudypad-pulumi-gcp-test")
    //     await preview(client, gcpInput)
    // })

    it('should preview Scaleway Pulumi stack without errors', async () => {
        const client = new ScalewayPulumiClient({
            stackName: "cloudypad-pulumi-scaleway-test",
            workspaceOptions: {} // use local config
        })
        await preview(client, scalewayInput)
    })
})
