import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1, GcpProvisionInputV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT } from '../utils';
import { InteractiveInstanceInitializer } from '../../../src/cli/initializer';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/cli';
import { STREAMING_SERVER_SUNSHINE } from '../../../src/cli/prompter';
import { StateLoader } from '../../../src/core/state/loader';
import { InstanceInitializer } from '../../../src/core/initializer';

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
            acceleratorType: "nvidia-tesla-t4",
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
        streamingServer: STREAMING_SERVER_SUNSHINE,
        sunshineUser: TEST_INPUT.configuration.sunshine?.username,
        sunshinePassword: TEST_INPUT.configuration.sunshine?.passwordBase64 ? Buffer.from(TEST_INPUT.configuration.sunshine.passwordBase64, 'base64').toString('utf-8') : undefined,
        sunshineImageRegistry: TEST_INPUT.configuration.sunshine?.imageRegistry,
        sunshineImageTag: TEST_INPUT.configuration.sunshine?.imageTag,
    }

    const TEST_CLI_ARGS_ALREADY_EXISTING: GcpCreateCliArgs = {
        ...TEST_CLI_ARGS,
        name: "gcp-dummy-already-exists-test",
        overwriteExisting: false,
    }

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('base initializer should initialize instance state with provided arguments', async () => {

        const baseInitializerTestInstanceName = "base-initializer-test-instance"

        await new InstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
        }).initializeInstance(baseInitializerTestInstanceName, TEST_INPUT.provision, TEST_INPUT.configuration)

        // Check state has been written
        const state = await new StateLoader().loadAndMigrateInstanceState(baseInitializerTestInstanceName)

        const expectState: GcpInstanceStateV1 = {
            version: "1",
            name: baseInitializerTestInstanceName,
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
                input: {
                    sunshine: {
                        enable: DEFAULT_COMMON_INPUT.configuration.sunshine?.enable ?? false,
                        username: DEFAULT_COMMON_INPUT.configuration.sunshine?.username ?? "",
                        passwordBase64: DEFAULT_COMMON_INPUT.configuration.sunshine?.passwordBase64 ?? "",
                        imageTag: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageTag ?? "",
                        imageRegistry: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageRegistry
                    }
                },
                output: {}
            }
        }
        
        assert.deepEqual(state, expectState)
    })

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('interactive initializer should initialize instance state with provided arguments without prompting for input', async () => {

        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter(),
            initArgs: TEST_CLI_ARGS
        }).initializeInteractive({ skipPostInitInfo: true })

        // Check state has been written
        const state = await new StateLoader().loadAndMigrateInstanceState(instanceName)

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
                input: {
                    sunshine: {
                        enable: DEFAULT_COMMON_INPUT.configuration.sunshine?.enable ?? false,
                        username: DEFAULT_COMMON_INPUT.configuration.sunshine?.username ?? "",
                        passwordBase64: DEFAULT_COMMON_INPUT.configuration.sunshine?.passwordBase64 ?? "",
                        imageTag: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageTag ?? "",
                        imageRegistry: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageRegistry
                    },
                    wolf: null
                },
                output: {}
            }
        }
        
        assert.deepEqual(state, expectState)
    })

    it('should failed to initialize for existing instance with no overwrite', async () => {

        // Initialize dummy instance 
        await new InteractiveInstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter(),
            initArgs: TEST_CLI_ARGS_ALREADY_EXISTING
        }).initializeInteractive({ skipPostInitInfo: true })

        await assert.rejects(async () => {
            // Initialize again, should throw exception as overwriteExisting is false
            return new InteractiveInstanceInitializer({ 
                provider: CLOUDYPAD_PROVIDER_GCP,
                inputPrompter: new GcpInputPrompter(),
                initArgs: TEST_CLI_ARGS_ALREADY_EXISTING
            }).initializeInteractive({ skipPostInitInfo: true })
        }, (thrown: unknown) => {
            return thrown instanceof Error && thrown.cause instanceof Error && thrown.cause.message.includes("Failed to prompt input")
        })
    })
})
    

