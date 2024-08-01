import * as assert from 'assert';
import { PaperspaceInitializerPrompt, PaperspaceProvisionArgs } from "../../../src/providers/paperspace/initializer"

describe('PaperspaceInitializerPrompt', () => {

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new PaperspaceInitializerPrompt();

        const opts: PaperspaceProvisionArgs = {
            apiKey: "xxxSecret",
            skipAuthCheck: true,
            create: {
                machineType: "P5000",
                diskSize: 100,
                publicIpType: "static",
                region: "East Coast (NY2)",
            },
        };

        const result = await awsInitializerPrompt.prompt(opts);
        assert.deepEqual(result, opts)
    });
});
