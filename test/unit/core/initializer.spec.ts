import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../common/utils';
import { InteractiveInstanceInitializer } from '../../../src/core/initializer';
import { StateManager } from '../../../src/core/state/manager';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/input';

describe('Instance initializer', () => {

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

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('should initialize instance state with provided arguments', async () => {

        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter()
        }).initializeInstance(TEST_CLI_ARGS, { skipPostInitInfo: true })

        // Check state has been written
        const state = await StateManager.default().loadInstanceStateSafe(instanceName)

        const expectState: GcpInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_GCP,
                input: TEST_INPUT.provision,
                output: {
                    host: "127.0.0.1",
                    instanceName: "dummy-gcp"
                }
            },
            configuration: {
                configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                input: {}
            }
        }
        
        assert.deepEqual(state, expectState)
    })
})
    

