import * as assert from 'assert';
import { AwsInitializerPrompt, AwsProvisionArgs } from "../../../src/providers/aws/initializer"

describe('AwsInitializerPrompt', () => {

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new AwsInitializerPrompt();

        const opts: AwsProvisionArgs = {
            create: {
                instanceType: "g5.2xlarge",
                diskSize: 200,
                publicIpType: "static",
                region: "us-west-2"
            },
            skipAuthCheck: true
        };

        const result = await awsInitializerPrompt.prompt(opts);
        assert.deepEqual(result, opts)
    });
});
