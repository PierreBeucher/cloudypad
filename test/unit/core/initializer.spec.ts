import * as assert from 'assert';
import * as lodash from 'lodash';
import * as sshpk from 'sshpk';
import { CLOUDYPAD_CONFIGURATOR_ANSIBLE, PUBLIC_IP_TYPE_STATIC, CLOUDYPAD_PROVIDER_DUMMY } from '../../../src/core/const';
import { DEFAULT_COMMON_INPUT, getUnitTestDummyProviderClient } from '../utils';
import { fromBase64 } from '../../../src/tools/base64';
import { InstanceInitializer } from '../../../src/core/initializer';
import { DummyInstanceInput, DummyInstanceStateV1 } from '../../../src/providers/dummy/state';

describe('Instance initializer', () => {

    const instanceName = "gcp-dummy"

    const TEST_INPUT: DummyInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            machineType: "dummy-type",
            diskSize: 100,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "dummy-region",
            zone: "dummy-zone",
            acceleratorType: "dummy-accelerator",
            projectId: "dummy-project",
            useSpot: false,
            instanceType: "dummy-instance-type",
            startDelaySeconds: 10,
            stopDelaySeconds: 10
        }, 
        configuration: {
            ansible: DEFAULT_COMMON_INPUT.configuration.ansible,
            autostop: DEFAULT_COMMON_INPUT.configuration.autostop,
            locale: DEFAULT_COMMON_INPUT.configuration.locale,
            keyboard: DEFAULT_COMMON_INPUT.configuration.keyboard,
            sunshine: DEFAULT_COMMON_INPUT.configuration.sunshine
        }
    }


    // Check instanceInitializer creates instance state as expected
    // Testing here using GCP state, but Initializer is generic and should work with any statet
    it('base initializer should initialize instance state with provided arguments', async () => {

        const testInstanceName = "base-initializer-test-instance-state-init"

        const dummyProvider = getUnitTestDummyProviderClient()
        await new InstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            stateWriter: dummyProvider.getStateWriter(),
            stateParser: dummyProvider.getStateParser()
        }).initializeStateOnly(testInstanceName, TEST_INPUT.provision, TEST_INPUT.configuration)

        // Check state has been written
        const loader = dummyProvider.getStateLoader()
        const state = await loader.loadInstanceState(testInstanceName)

        const expectState: DummyInstanceStateV1 = {
            version: "1",
            name: testInstanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_DUMMY,
                input: TEST_INPUT.provision,
            },
            configuration: {
                configurator: CLOUDYPAD_CONFIGURATOR_ANSIBLE,
                input: TEST_INPUT.configuration,
            }
        }
        
        assert.deepStrictEqual(state.configuration, expectState.configuration)
        assert.deepStrictEqual(state.provision, expectState.provision)
        assert.deepStrictEqual(state.name, expectState.name)
    })

    it('should initialize instance with auto generated SSH key when no SSH key path or content is provided', async () => {

        const dummyProviderClient = getUnitTestDummyProviderClient()

        // use default input but remove SSH key path and content for testing
        const testInput = lodash.cloneDeep(TEST_INPUT)
        testInput.provision.ssh.privateKeyPath = undefined
        testInput.provision.ssh.privateKeyContentBase64 = undefined

        await new InstanceInitializer({ 
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            stateWriter: dummyProviderClient.getStateWriter(),
            stateParser: dummyProviderClient.getStateParser()
        }).initializeStateOnly("test-auto-generate-ssh-key", testInput.provision, testInput.configuration)

        // Check state has been written
        const loader = dummyProviderClient.getStateLoader()
        const state = await loader.loadInstanceState("test-auto-generate-ssh-key")

        assert.equal(state.provision.input.ssh.privateKeyPath, undefined)
        assert.ok(state.provision.input.ssh.privateKeyContentBase64)

        const privateKeyContent = fromBase64(state.provision.input.ssh.privateKeyContentBase64)

        // try to load key content (should have been generated randomly)
        const parsedKey = sshpk.parseKey(privateKeyContent, "ssh-private").toString("ssh-private")
        assert.ok(parsedKey.startsWith("-----BEGIN OPENSSH PUBLIC KEY-----"))
    })
})
        
