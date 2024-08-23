import * as assert from 'assert';
import { PaperspaceInitializerPrompt, PaperspaceInstanceInitializer, PaperspaceProvisionArgs } from "../../../src/providers/paperspace/initializer"
import sinon from 'sinon';
import { PaperspaceAuthResponse, PaperspaceClient, PaperspaceMachine } from '../../../src/providers/paperspace/client/client';
import { PaperspaceInstanceRunner } from '../../../src/providers/paperspace/runner';
import { AnsibleClient } from '../../../src/tools/ansible';
import { StateUtils } from '../../../src/core/state';
import { InstanceInitializationOptions } from '../../../src/core/initializer';

describe('PaperspaceInitializerPrompt', () => {

    const provArgs: PaperspaceProvisionArgs = {
        apiKey: "xxxSecret",
        create: {
            machineType: "P5000",
            diskSize: 100,
            publicIpType: "static",
            region: "East Coast (NY2)",
        },
    }

    const genericArgs = {
        instanceName: "paperspace-dummy",
        sshKey: "test/resources/ssh-key",
    }

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const awsInitializerPrompt = new PaperspaceInitializerPrompt();

        const result = await awsInitializerPrompt.prompt(provArgs);
        assert.deepEqual(result, provArgs)
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

        await new PaperspaceInstanceInitializer(genericArgs, provArgs).initializeInstance(opts)

        // Check state has been written
        const sm = await StateUtils.loadInstanceState(genericArgs.instanceName)
        const state = sm.get()

        assert.equal(state.host, dummyMachine.publicIp)
        assert.equal(state.name, genericArgs.instanceName)
        assert.deepEqual(state.provider?.paperspace, {
            machineId: dummyMachine.id,
            apiKey: provArgs.apiKey,
            provisionArgs: provArgs
        })
        assert.deepEqual(state.ssh, { user: "paperspace", privateKeyPath: genericArgs.sshKey})
        assert.equal(state.status.configuration.configured, true)
        assert.equal(state.status.provision.provisioned, true)
        assert.equal(state.status.initalized, true)
        
        pspaceClientCheckAuthStub.restore()
        pspaceClientCreateMachineStub.restore()
        pairStub.restore()
        ansibleStub.restore()
        
    })
})
