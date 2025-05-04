import * as assert from 'assert';
import { DUMMY_SSH_KEY_PATH, getUnitTestCoreClient, loadDumyAnonymousStateV1 } from '../utils';
import { AwsInstanceStateV1, AwsStateParser } from '../../../src/providers/aws/state';
import { InstanceUpdater } from '../../../src/core/updater';

describe('InstanceUpdater', () => {

    it('should update instance state with provided arguments', async () => {
        
        // Load known state into dummy writer after changing its name to avoid collision
        const awsState = new AwsStateParser().parse(loadDumyAnonymousStateV1("aws-dummy"))

        const instanceName = "aws-dummy-test-update"
        awsState.name = instanceName

        // write a new state to avoid collision
        const coreClient = getUnitTestCoreClient()
        const stateWriter = coreClient.buildStateWriterFor(awsState)
        await stateWriter.persistStateNow()

        const stateLoader = coreClient.buildStateLoader()

        const updater = new InstanceUpdater<AwsInstanceStateV1>({
            stateParser: new AwsStateParser(),
            stateWriter: stateWriter,
            stateLoader: stateLoader
        })

        const newConfigurationInputs: AwsInstanceStateV1["configuration"]["input"] = {
            autostop: {
                enable: !awsState.configuration.input.autostop?.enable ?? false,
                timeoutSeconds: (awsState.configuration.input.autostop?.timeoutSeconds ?? 0) + 1
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
                username: "xxx"
            },
            wolf: null
        }

        const newProvisionInputs: AwsInstanceStateV1["provision"]["input"] = {
            diskSize: awsState.provision.input.diskSize + 100,
            instanceType: "t2.micro",
            publicIpType: "static",
            region: "us-east-1",
            ssh: {
                user: "test",
            },
            useSpot: false
        }

        await updater.updateStateOnly(instanceName, newConfigurationInputs, newProvisionInputs)

        const expectedState = {
            ...awsState,
            provision: {
                ...awsState.provision,
                input: {
                    ...awsState.provision.input,
                    ...newProvisionInputs,
                    ssh: {
                        ...awsState.provision.input.ssh,
                        ...newProvisionInputs.ssh,
                    }
                },
                output: awsState.provision.output,
            },
            configuration: {
                ...awsState.configuration,
                input: newConfigurationInputs,
                // output: awsState.configuration.output
            }
        }

        // Check dummy state after update
        const updatedState = await stateLoader.loadInstanceState(instanceName)
        assert.deepStrictEqual(updatedState, expectedState)
    })
})
    

