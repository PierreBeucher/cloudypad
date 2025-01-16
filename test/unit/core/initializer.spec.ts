import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../utils';
import { InteractiveInstanceInitializer } from '../../../src/core/initializer';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/cli';
import { StateLoader } from '../../../src/core/state/loader';

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
            costAlert: null
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
        costAlert: false,
    }

    const TEST_CLI_ARGS_ALREADY_EXISTING: GcpCreateCliArgs = {
        ...TEST_CLI_ARGS,
        name: "gcp-dummy-already-exists-test",
        overwriteExisting: false,
    }

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('should initialize instance state with provided arguments', async () => {

        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter()
        }).initializeInstance(TEST_CLI_ARGS, { skipPostInitInfo: true })

        // Check state has been written
        const state = await new StateLoader().loadInstanceStateSafe(instanceName)

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
                input: {},
                output: {}
            }
        }
        
        assert.deepEqual(state, expectState)
    })

    it('should failed to initialize for existing instance with no overwrite', async () => {

        // Initialize dummy instance 
        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter()
        }).initializeInstance(TEST_CLI_ARGS_ALREADY_EXISTING, { skipPostInitInfo: true })

        await assert.rejects(async () => {
            // Initialize again, should throw exception as overwriteExisting is false
            return new InteractiveInstanceInitializer({ 
                provider: CLOUDYPAD_PROVIDER_GCP,
                inputPrompter: new GcpInputPrompter()
            }).initializeInstance(TEST_CLI_ARGS_ALREADY_EXISTING, { skipPostInitInfo: true })
        }, (thrown: unknown) => {
            return thrown instanceof Error && thrown.cause instanceof Error && thrown.cause.message.includes("Won't overwrite existing instance")
        })
    })
})
    

