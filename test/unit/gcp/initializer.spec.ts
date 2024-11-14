import * as assert from 'assert';
import { CommonInitConfig, InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { InstanceStateV1, StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { GcpInitializerPrompt, GcpInstanceInitializer } from '../../../src/providers/gcp/initializer';
import { GcpClient } from '../../../src/tools/gcp';
import { GcpPulumiClient, GcpPulumiOutput } from '../../../src/tools/pulumi/gcp';
import { GcpInstanceRunner } from '../../../src/providers/gcp/runner';
import { GcpProvisionConfigV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_PROVIDER_GCP } from '../../../src/core/const';

describe('GCP initializer', () => {

    const provConf: GcpProvisionConfigV1 = {
        machineType: "n1-standard-8",
        diskSize: 200,
        publicIpType: "static",
        region: "europe-west4",
        zone: "europe-west4-b",
        acceleratorType: "nvidia-tesla-p4",
        projectId: "crafteo-sandbox",
        useSpot: true,
    }
    
    const genericArgs: CommonInitConfig = {
        instanceName: "gcp-dummy",
        provisionConfig: {
            ssh: {
                privateKeyPath: "./test/resources/ssh-key",
                user: "ubuntu"
            }
        }
    }

    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const promt = new GcpInitializerPrompt();
        const result = await promt.prompt(provConf);
        assert.deepEqual(result, provConf)
    })


    it('should initialize instance state with provided arguments', async () => {

        // Stub everything interacting with GCP and VM
        // We just need to check state written on disk and overall process works
        const gcpClientStub = sinon.stub(GcpClient.prototype, 'checkAuth').resolves()
        const dummyPulumiOutput: GcpPulumiOutput = { instanceName: "dummy-gcp", publicIp: "127.0.0.1"}
        const pulumiClientConfigStub = sinon.stub(GcpPulumiClient.prototype, 'setConfig').resolves()
        const pulumiClientUpStub = sinon.stub(GcpPulumiClient.prototype, 'up').resolves(dummyPulumiOutput)
        const pairStub = sinon.stub(GcpInstanceRunner.prototype, 'pair').resolves()
        const ansibleStub = sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        await new GcpInstanceInitializer(genericArgs, provConf).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(genericArgs.instanceName)

        const expectState: InstanceStateV1 = {
            name: genericArgs.instanceName,
            provision: {
                common: {
                    config: genericArgs.provisionConfig,
                    output: {
                        host: "127.0.0.1"
                    }
                },
                provider: CLOUDYPAD_PROVIDER_GCP,
                gcp: {
                    config: provConf,
                    output: {
                        instanceName: "dummy-gcp"
                    }
                }
            },
            version: "1"
        }
        
        assert.deepEqual(state, expectState)

        gcpClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

