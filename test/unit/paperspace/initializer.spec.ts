import * as assert from 'assert';
import { PaperspaceInstanceInitializer } from "../../../src/providers/paperspace/initializer"
import sinon from 'sinon';
import { PaperspaceAuthResponse, PaperspaceClient, PaperspaceMachine } from '../../../src/providers/paperspace/client/client';
import { PaperspaceInstanceRunner } from '../../../src/providers/paperspace/runner';
import { AnsibleClient } from '../../../src/tools/ansible';
import { StateUtils } from '../../../src/core/state';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import { PaperspaceInstanceStateV1, PaperspaceProvisionConfigV1 } from '../../../src/providers/paperspace/state';
import { CLOUDYPAD_PROVIDER_PAPERSPACE } from '../../../src/core/const';
import { DEFAULT_COMMON_CONFIG } from '../common/utils';

describe('PaperspaceInitializerPrompt', () => {

    const conf: PaperspaceProvisionConfigV1 = {
        ...DEFAULT_COMMON_CONFIG,
        apiKey: "xxxSecret",
        machineType: "P5000",
        diskSize: 100,
        publicIpType: "static",
        region: "East Coast (NY2)",
    }

    const instanceName = "paperspace-dummy"
    
    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new PaperspaceInstanceInitializer({ instanceName: instanceName, config: conf})

        const result = await awsInitializerPrompt.promptProviderConfig(DEFAULT_COMMON_CONFIG);
        assert.deepEqual(result, conf)
    })

    it('should initialize instance state with provided arguments', async () => {

        // Stub everything interacting with GCP and VM
        // We just need to check state written on disk and overall process works
        const dummyMachine: PaperspaceMachine = {
            id: "machine-123456788",
            name: "test-machine",
            state: "running",
            machineType: "RTX4000",
            privateIp: "192.168.0.10",
            publicIp: "127.0.0.1",
            publicIpType: "static"
        }
        const dummyAuthResp: PaperspaceAuthResponse = {
            user: {
                email: "dummypspace@foo.bar",
                id: "userxxxx"
            },
            team: {
                namespace: "ns",
                id: "teamzzzz"
            }
        }
        const pspaceClientCheckAuthStub = sinon.stub(PaperspaceClient.prototype, 'checkAuth').resolves(dummyAuthResp)
        const pspaceClientCreateMachineStub = sinon.stub(PaperspaceClient.prototype, 'createMachine').resolves(dummyMachine)
        const pairStub = sinon.stub(PaperspaceInstanceRunner.prototype, 'pair').resolves()
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        await new PaperspaceInstanceInitializer({ instanceName: instanceName, config: conf}).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(instanceName)

        const expectState: PaperspaceInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_PAPERSPACE,
                config: conf,
                output: {
                    host: "127.0.0.1",
                    machineId: "machine-123456788"
                }
            },
        }

        assert.deepEqual(state, expectState)

        pspaceClientCheckAuthStub.restore()
        pspaceClientCreateMachineStub.restore()
        pairStub.restore()
        ansibleStub.restore()
        
    })
})
