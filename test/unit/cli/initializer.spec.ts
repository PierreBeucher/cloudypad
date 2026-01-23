import * as assert from 'assert';
import { GcpInstanceInput, GcpInstanceStateV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_DUMMY, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT, getUnitTestCoreClient, getUnitTestCoreConfig, getUnitTestDummyProviderClient } from '../utils';
import { InteractiveInstanceInitializer } from '../../../src/cli/initializer';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../src/providers/gcp/cli';
import { STREAMING_SERVER_SUNSHINE } from '../../../src/cli/prompter';
import { DummyInputPrompter } from '../../../src/providers/dummy/cli';
import { DummyInstanceStateV1, DummyInstanceInput } from '../../../src/providers/dummy/state';
import { PUBLIC_IP_TYPE } from '../../../src/core/const';
import { DummyCreateCliArgs } from '../../../src/providers/dummy/cli';

describe('Instance initializer', () => {

    const coreConfig = getUnitTestCoreConfig()

    const instanceName = "cli-instance-initializer-test"

    const TEST_INPUT: DummyInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            instanceType: "initializer-test-dummy-instance-type",
            startDelaySeconds: 10,
            stopDelaySeconds: 10,
            configurationDelaySeconds: 0,
            provisioningDelaySeconds: 0,
            readinessAfterStartDelaySeconds: 0,
            initialServerStateAfterProvision: "running",
            deleteInstanceServerOnStop: false,
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    /**
     * CLI args that should not trigger interactive input
     */
    const TEST_CLI_ARGS: DummyCreateCliArgs = {
        name: TEST_INPUT.instanceName,
        yes: true,
        overwriteExisting: true,
        sshPrivateKey: TEST_INPUT.provision.ssh?.privateKeyPath as string,
        ansibleAdditionalArgs: "",
        configurationDelaySeconds: 0,
        streamingServer: STREAMING_SERVER_SUNSHINE,
        sunshineUser: TEST_INPUT.configuration.sunshine?.username as string,
        sunshinePassword: TEST_INPUT.configuration.sunshine?.passwordBase64 ? Buffer.from(TEST_INPUT.configuration.sunshine.passwordBase64, 'base64').toString('utf-8') : undefined,
        sunshineImageRegistry: TEST_INPUT.configuration.sunshine?.imageRegistry as string,
        sunshineImageTag: TEST_INPUT.configuration.sunshine?.imageTag as string,
        autostop: TEST_INPUT.configuration.autostop?.enable as boolean,
        autostopTimeout: TEST_INPUT.configuration.autostop?.timeoutSeconds as number,
        useLocale: TEST_INPUT.configuration.locale as string,
        keyboardLayout: TEST_INPUT.configuration.keyboard?.layout as string,
        keyboardModel: TEST_INPUT.configuration.keyboard?.model as string,
        keyboardVariant: TEST_INPUT.configuration.keyboard?.variant as string,
        keyboardOptions: TEST_INPUT.configuration.keyboard?.options as string,
        instanceType: TEST_INPUT.provision.instanceType,
        startDelaySeconds: TEST_INPUT.provision.startDelaySeconds,
        stopDelaySeconds: TEST_INPUT.provision.stopDelaySeconds,
        ratelimitMaxMbps: TEST_INPUT.configuration.ratelimit?.maxMbps,
    }

    const TEST_CLI_ARGS_ALREADY_EXISTING: DummyCreateCliArgs = {
        ...TEST_CLI_ARGS,
        name: "initializer-already-exists-test",
        overwriteExisting: false,
    }

    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('interactive initializer should initialize instance state with provided arguments without prompting for input', async () => {

        const dummyProviderClient = getUnitTestDummyProviderClient()

        await new InteractiveInstanceInitializer({ 
            providerClient: dummyProviderClient,
            inputPrompter: new DummyInputPrompter({ coreConfig: coreConfig }),
            initArgs: TEST_CLI_ARGS,
        }).initializeInteractive({ skipPostInitInfo: true })

        // Check state has been written
        const loader = dummyProviderClient.getStateLoader()
        const state = await loader.loadInstanceState(instanceName)

        const expectState: DummyInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_DUMMY,
                input: {
                    ...TEST_INPUT.provision,
                    // runtime inputs are set after initialization, so are undefined
                    runtime: {
                        dataDiskState: 'live',
                        instanceServerState: 'present'
                    }
                },
                output: {
                    host: "127.0.0.1",
                    publicIPv4: "127.0.0.1",
                    instanceId: "dummy-instance-id",
                    provisionedAt: 1234567890,
                }
            },
            configuration: {
                configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                input: {
                    ratelimit: {
                        maxMbps: TEST_INPUT.configuration.ratelimit?.maxMbps,
                    },
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
            }
        }
        
        assert.strictEqual(state.name, expectState.name)
        assert.deepStrictEqual(state.configuration.input, expectState.configuration.input)
        assert.deepStrictEqual(state.provision.input, expectState.provision.input)
        // don't compare outputs as they contain auto generated values
    })

    it('should failed to initialize for existing instance with no overwrite', async () => {

        const dummyProviderClient = getUnitTestDummyProviderClient()

        const initializer = new InteractiveInstanceInitializer({ 
            providerClient: dummyProviderClient,
            inputPrompter: new DummyInputPrompter({ coreConfig: coreConfig }),
            initArgs: TEST_CLI_ARGS_ALREADY_EXISTING
        })

        // Initialize dummy instance 
        await initializer.initializeInteractive({ skipPostInitInfo: true })

        await assert.rejects(async () => {
            // Initialize again, should throw exception as overwriteExisting is false
            await initializer.initializeInteractive({ skipPostInitInfo: true })
        }, (thrown: unknown) => {
            return thrown instanceof Error && thrown.cause instanceof Error && thrown.cause.message.includes("Failed to prompt input")
        })
    })

})
        
