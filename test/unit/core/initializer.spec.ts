import * as assert from 'assert';
import * as lodash from 'lodash';
import * as sshpk from 'sshpk';
import { GcpInstanceInput, GcpInstanceStateV1, GcpProvisionInputV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, CLOUDYPAD_PROVIDER_GCP, PUBLIC_IP_TYPE_STATIC } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT, getUnitTestCoreClient } from '../utils';
import { fromBase64 } from '../../../src/tools/base64';
import { InstanceInitializer } from '../../../src/core/initializer';
import { CommonConfigurationInputV1 } from '../../../src/core/state/state';

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


    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('base initializer should initialize instance state with provided arguments', async () => {

        const testInstanceName = "base-initializer-test-instance-state-init"

        await new InstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            stateWriter: getUnitTestCoreClient().buildEmptyStateWriter()
        }).initializeStateOnly(testInstanceName, TEST_INPUT.provision, TEST_INPUT.configuration)

        // Check state has been written
        const loader = getUnitTestCoreClient().buildStateLoader()
        const state = await loader.loadInstanceState(testInstanceName)

        const expectState: GcpInstanceStateV1 = {
            version: "1",
            name: testInstanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_GCP,
                input: TEST_INPUT.provision,
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
                        enable: DEFAULT_COMMON_INPUT.configuration.autostop?.enable ?? false,
                        timeoutSeconds: DEFAULT_COMMON_INPUT.configuration.autostop?.timeoutSeconds ?? 999
                    },
                    locale: DEFAULT_COMMON_INPUT.configuration.locale,
                    keyboard: {
                        layout: DEFAULT_COMMON_INPUT.configuration.keyboard?.layout,
                        model: DEFAULT_COMMON_INPUT.configuration.keyboard?.model,
                        variant: DEFAULT_COMMON_INPUT.configuration.keyboard?.variant,
                        options: DEFAULT_COMMON_INPUT.configuration.keyboard?.options
                    }
                }
            }
        }
        
        assert.deepEqual(state, expectState)
    })

    it('should initialize instance with auto generated SSH key when no SSH key path or content is provided', async () => {

        // use default input but remove SSH key path and content for testing
        const testInput = lodash.cloneDeep(TEST_INPUT)
        testInput.provision.ssh.privateKeyPath = undefined
        testInput.provision.ssh.privateKeyContentBase64 = undefined

        await new InstanceInitializer<GcpProvisionInputV1, CommonConfigurationInputV1>({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            stateWriter: getUnitTestCoreClient().buildEmptyStateWriter()
        }).initializeStateOnly("test-auto-generate-ssh-key", testInput.provision, testInput.configuration)

        // Check state has been written
        const loader = getUnitTestCoreClient().buildStateLoader()
        const state = await loader.loadInstanceState("test-auto-generate-ssh-key")

        assert.equal(state.provision.input.ssh.privateKeyPath, undefined)
        assert.ok(state.provision.input.ssh.privateKeyContentBase64)

        const privateKeyContent = fromBase64(state.provision.input.ssh.privateKeyContentBase64)

        // try to load key content (should have been generated randomly)
        const parsedKey = sshpk.parseKey(privateKeyContent, "ssh-private").toString("ssh-private")
        assert.ok(parsedKey.startsWith("-----BEGIN OPENSSH PUBLIC KEY-----"))
    })

    // Lägg till ett nytt test för lösenordsautentisering
    it('should skip SSH key generation when using password authentication', async () => {

        // Använd default input men lägg till lösenordsautentisering
        const testInput = lodash.cloneDeep(TEST_INPUT);
        testInput.provision.ssh.privateKeyPath = undefined;
        testInput.provision.ssh.privateKeyContentBase64 = undefined;
        
        // Lägg till auth-objekt för lösenordsautentisering
        (testInput.provision as any).auth = {
            type: "password" as const,
            ssh: {
                user: "test-user",
                password: "test-password"
            }
        };

        await new InstanceInitializer<GcpProvisionInputV1, CommonConfigurationInputV1>({ 
            provider: CLOUDYPAD_PROVIDER_GCP,
            stateWriter: getUnitTestCoreClient().buildEmptyStateWriter()
        }).initializeStateOnly("test-password-auth", testInput.provision, testInput.configuration);

        // Check state has been written
        const loader = getUnitTestCoreClient().buildStateLoader();
        const state = await loader.loadInstanceState("test-password-auth");

        // Verifiera att auth-objektet finns
        assert.ok((state.provision.input as any).auth);
        assert.strictEqual((state.provision.input as any).auth.type, "password");
        assert.strictEqual((state.provision.input as any).auth.ssh.user, "test-user");
        assert.strictEqual((state.provision.input as any).auth.ssh.password, "test-password");

        // Verifiera att ingen SSH-nyckel genererades
        assert.equal(state.provision.input.ssh.privateKeyPath, undefined);
        assert.equal(state.provision.input.ssh.privateKeyContentBase64, undefined);
    });
})
        
