import * as assert from 'assert';
import { GcpInstanceInput } from '../../../src/providers/gcp/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/input';
import lodash from 'lodash'
import { PartialDeep } from 'type-fest';

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
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    /**
     * CLI args that should not trigger interactive input
     */
    const TEST_CLI_ARGS: GcpCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        autoApprove: true,
        overwriteExisting: false,
        privateSshKey: TEST_INPUT.provision.ssh.privateKeyPath,
        projectId: TEST_INPUT.provision.projectId,
        region: TEST_INPUT.provision.region,
        zone: TEST_INPUT.provision.zone,
        machineType: TEST_INPUT.provision.machineType,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        gpuType: TEST_INPUT.provision.acceleratorType,
        spot: TEST_INPUT.provision.useSpot,
    }

    it('should convert CLI args into partial input', () => {
        
        const prompter = new GcpInputPrompter()
        const result = prompter.cliArgsIntoInput(TEST_CLI_ARGS)

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
    

