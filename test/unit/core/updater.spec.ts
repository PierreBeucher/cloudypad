import * as assert from 'assert';
import { DUMMY_SSH_KEY_PATH, getUnitTestCoreClient, getUnitTestCoreConfig, loadDumyAnonymousStateV1 } from '../utils';
import { AwsInstanceStateV1, AwsStateParser } from '../../../src/providers/aws/state';
import { InstanceUpdater } from '../../../src/core/updater';
import { DummyProviderClient } from '../../../src/providers/dummy/provider';
import { DummyInstanceStateV1, DummyStateParser } from '../../../src/providers/dummy/state';

describe('InstanceUpdater', () => {

    const coreConfig = getUnitTestCoreConfig()

    it('should update instance state with provided arguments', async () => {
        
        // Load known state into dummy writer after changing its name to avoid collision
        const dummyState = new DummyStateParser().parse(loadDumyAnonymousStateV1("dummy-provider-state"))

        const instanceName = "instance-updater-test-dummy-instance"
        dummyState.name = instanceName

        // write a new state to avoid collision
        const dummyProviderClient = new DummyProviderClient({ config: coreConfig })
        const stateWriter = dummyProviderClient.getStateWriter()
        await stateWriter.setStateAndPersistNow(dummyState)

        const stateLoader = dummyProviderClient.getStateLoader()

        const updater = new InstanceUpdater<DummyInstanceStateV1>({
            stateParser: new DummyStateParser(),
            stateWriter: stateWriter,
            stateLoader: stateLoader
        })

        const newConfigurationInputs: DummyInstanceStateV1["configuration"]["input"] = {
            autostop: {
                enable: !dummyState.configuration.input.autostop?.enable,
                timeoutSeconds: (dummyState.configuration.input.autostop?.timeoutSeconds ?? 0) + 1
            },
            ansible: {
                additionalArgs: "--new-additional-args"
            },
            keyboard: {
                layout: "en-US",
                model: "pc105",
                variant: "pc105",
                options: "xxx"
            },
            locale: "en-US",
            sunshine: {
                enable: true,
                passwordBase64: "xxx",
                username: "xxx",
                serverName: "new-server-name"
            },
            wolf: null
        }

        const newProvisionInputs: DummyInstanceStateV1["provision"]["input"] = {
            instanceType: "dummy-instance-type-after-update",
            startDelaySeconds: 999,
            stopDelaySeconds: 999,
            configurationDelaySeconds: 999,
            provisioningDelaySeconds: 999,
            readinessAfterStartDelaySeconds: 999,
            initialServerStateAfterProvision: "stopped",
            deleteInstanceServerOnStop: true,
            ssh: {
                user: "ssh-user-after-update",
                privateKeyContentBase64: "ssh-private-key-after-update"
            }
        }

        await updater.updateStateOnly({ 
            instanceName: instanceName, 
            configurationInputs: newConfigurationInputs,
            provisionInputs: newProvisionInputs
        })

        const expectedState = {
            ...dummyState,
            provision: {
                ...dummyState.provision,
                input: {
                    ...dummyState.provision.input,
                    ...newProvisionInputs,
                    ssh: {
                        ...dummyState.provision.input.ssh,
                        ...newProvisionInputs.ssh,
                    }
                },
                output: dummyState.provision.output,
            },
            configuration: {
                ...dummyState.configuration,
                input: newConfigurationInputs,
                // output: awsState.configuration.output
            }
        }

        // Check dummy state after update
        const updatedState = await stateLoader.loadInstanceState(instanceName)
        assert.deepStrictEqual(updatedState, expectedState)
    })
})
    

