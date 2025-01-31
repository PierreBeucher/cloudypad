import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../src/providers/gcp/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../utils';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/cli';
import lodash from 'lodash'
import { PartialDeep } from 'type-fest';
import { StateWriter } from '../../../src/core/state/writer';
import { STREAMING_SERVER_SUNSHINE } from '../../../src/core/cli/prompter';

describe('GCP input prompter', () => {

    const instanceName = "gcp-dummy"

    const TEST_INPUT: GcpInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            machineType: "n1-standard-8",
            diskSize: 200,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "europe-west4",
            zone: "europe-west4-b",
            acceleratorType: "nvidia-tesla-p4",
            projectId: "crafteo-sandbox",
            useSpot: true,
            costAlert: {
                notificationEmail: "test@test.com",
                limit: 100
            }
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        },
    }

    /**
     * CLI args that should not trigger interactive input
     */
    const TEST_CLI_ARGS: GcpCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        yes: true,
        overwriteExisting: true,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        projectId: TEST_INPUT.provision.projectId,
        region: TEST_INPUT.provision.region,
        zone: TEST_INPUT.provision.zone,
        machineType: TEST_INPUT.provision.machineType,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        gpuType: TEST_INPUT.provision.acceleratorType,
        spot: TEST_INPUT.provision.useSpot,
        costNotificationEmail: TEST_INPUT.provision.costAlert?.notificationEmail,
        costLimit: TEST_INPUT.provision.costAlert?.limit,
        streamingServer: STREAMING_SERVER_SUNSHINE,
        sunshineUsername: TEST_INPUT.configuration.sunshine?.username,
        sunshinePassword: TEST_INPUT.configuration.sunshine?.passwordBase64,
    }

    it('should convert CLI args into partial input', () => {
        
        const prompter = new GcpInputPrompter()
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<GcpInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            }
        }
        
        assert.deepEqual(result, expected)
    })

    it('should return provided inputs without prompting when full input provider', async () => {

        const result = await new GcpInputPrompter().promptInput(TEST_INPUT, { overwriteExisting: true, autoApprove: true })
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new GcpInputPrompter()
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<GcpInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
    

