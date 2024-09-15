import { AwsPulumiClient } from "../../../src/tools/pulumi/aws"
import { AzurePulumiClient } from "../../../src/tools/pulumi/azure";
import { InstancePulumiClient } from "../../../src/tools/pulumi/client";
import { GcpPulumiClient } from "../../../src/tools/pulumi/gcp";
import { awsConfig, azureConfig, gcpConfig } from "./test-config.spec"

describe('Test Pulumi preview', function() {

    // Pulumi is expected to take a few seconds, even minutes, to run
    this.timeout(5*60*1000); 

    async function preview<C, O>(client: InstancePulumiClient<C, O>, config: C){
        await client.setConfig(config)
        
        const previewRes = await client.preview()
        console.info(`Pulumi ${client.stackName} result: ${JSON.stringify(previewRes)}`)
    }

    it('should preview AWS Pulumi stack without errors', async () => {
        const client = new AwsPulumiClient("cloudypad-pulumi-aws-test")
        preview(client, awsConfig)
    })

    it('should preview Azure Pulumi stack without errors', async () => {
        const client = new AzurePulumiClient("cloudypad-pulumi-azure-test")
        preview(client, azureConfig)
    })

    it('should preview GCP Pulumi stack without errors', async () => {
        const client = new GcpPulumiClient("cloudypad-pulumi-gcp-test")
        preview(client, gcpConfig)
    })
})
