import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT, getUnitTestCoreClient } from '../utils';
import { InteractiveInstanceInitializer } from '../../../src/cli/initializer';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/cli';
import { STREAMING_SERVER_SUNSHINE } from '../../../src/cli/prompter';

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
        autostop: TEST_INPUT.configuration.autostop?.enable,
        autostopTimeout: TEST_INPUT.configuration.autostop?.timeoutSeconds,
        useLocale: TEST_INPUT.configuration.locale,
        keyboardLayout: TEST_INPUT.configuration.keyboard?.layout,
        keyboardModel: TEST_INPUT.configuration.keyboard?.model,
        keyboardVariant: TEST_INPUT.configuration.keyboard?.variant,
        keyboardOptions: TEST_INPUT.configuration.keyboard?.options,
    }

    const TEST_CLI_ARGS_ALREADY_EXISTING: GcpCreateCliArgs = {
        ...TEST_CLI_ARGS,
        name: "gcp-dummy-already-exists-test",
        overwriteExisting: false,
    }

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('interactive initializer should initialize instance state with provided arguments without prompting for input', async () => {

        const coreClient = getUnitTestCoreClient()

        await new InteractiveInstanceInitializer({ 
            coreClient: coreClient,
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter({ coreClient: coreClient }),
            initArgs: TEST_CLI_ARGS,
        }).initializeInteractive({ skipPostInitInfo: true })

        // Check state has been written
        const loader = coreClient.buildStateLoader()
        const state = await loader.loadInstanceState(instanceName)

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
                    autostop: {
                        enable: TEST_INPUT.configuration.autostop?.enable ?? false,
                        timeoutSeconds: TEST_INPUT.configuration.autostop?.timeoutSeconds ?? 999
                    },
                    wolf: null,
                    locale: DEFAULT_COMMON_INPUT.configuration.locale,
                    keyboard: {
                        layout: DEFAULT_COMMON_INPUT.configuration.keyboard?.layout,
                        model: DEFAULT_COMMON_INPUT.configuration.keyboard?.model,
                        variant: DEFAULT_COMMON_INPUT.configuration.keyboard?.variant,
                        options: DEFAULT_COMMON_INPUT.configuration.keyboard?.options
                    }
                },
                output: {
                    dataDiskConfigured: false
                }
            }
        }
        
        assert.strictEqual(state.name, expectState.name)
        assert.deepStrictEqual(state.configuration, expectState.configuration)
        assert.deepStrictEqual(state.provision, expectState.provision)
    })

    it('should failed to initialize for existing instance with no overwrite', async () => {

        const coreClient = getUnitTestCoreClient()

        // Initialize dummy instance 
        await new InteractiveInstanceInitializer({ 
            coreClient: coreClient,
            provider: CLOUDYPAD_PROVIDER_GCP,
            inputPrompter: new GcpInputPrompter({ coreClient: coreClient }),
            initArgs: TEST_CLI_ARGS_ALREADY_EXISTING
        }).initializeInteractive({ skipPostInitInfo: true })

        await assert.rejects(async () => {
            // Initialize again, should throw exception as overwriteExisting is false
            return new InteractiveInstanceInitializer({ 
                coreClient: coreClient,
                provider: CLOUDYPAD_PROVIDER_GCP,
                inputPrompter: new GcpInputPrompter({ coreClient: coreClient }),
                initArgs: TEST_CLI_ARGS_ALREADY_EXISTING
            }).initializeInteractive({ skipPostInitInfo: true })
        }, (thrown: unknown) => {
            return thrown instanceof Error && thrown.cause instanceof Error && thrown.cause.message.includes("Failed to prompt input")
        })
    })

})
        
