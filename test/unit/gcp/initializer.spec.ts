import * as assert from 'assert';
import { InstanceInitializationOptions } from '../../../src/core/initializer';
import sinon from 'sinon';
import { StateUtils } from '../../../src/core/state';
import { AnsibleClient } from '../../../src/tools/ansible';
import { GcpInstanceInitializer } from '../../../src/providers/gcp/initializer';
import { GcpClient } from '../../../src/tools/gcp';
import { GcpPulumiClient, GcpPulumiOutput } from '../../../src/tools/pulumi/gcp';
import { GcpInstanceRunner } from '../../../src/providers/gcp/runner';
import { GcpInstanceStateV1, GcpProvisionConfigV1 } from '../../../src/providers/gcp/state';
import { CLOUDYPAD_PROVIDER_GCP } from '../../../src/core/const';
import { DEFAULT_COMMON_CONFIG } from '../common/utils';

describe('GCP initializer', () => {

    const conf: GcpProvisionConfigV1 = {
        ...DEFAULT_COMMON_CONFIG,
        machineType: "n1-standard-8",
        diskSize: 200,
        publicIpType: "static",
        region: "europe-west4",
        zone: "europe-west4-b",
        acceleratorType: "nvidia-tesla-p4",
        projectId: "crafteo-sandbox",
        useSpot: true,
    }
    
    const instanceName = "gcp-dummy"
    
    const opts: InstanceInitializationOptions = {
        autoApprove: true,
        overwriteExisting: true
    }

    it('should return provided options without prompting for user input', async () => {

        const promt = new GcpInstanceInitializer({ instanceName: instanceName, config: conf})
        const result = await promt.promptProviderConfig(DEFAULT_COMMON_CONFIG)
        assert.deepEqual(result, conf)
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

        await new GcpInstanceInitializer({ instanceName: instanceName, config: conf}).initializeInstance(opts)

        // Check state has been written
        const state = await StateUtils.loadInstanceState(instanceName)

        const expectState: GcpInstanceStateV1 = {
            version: "1",
            name: instanceName,
            provision: {
                provider: CLOUDYPAD_PROVIDER_GCP,
                config: conf,
                output: {
                    host: "127.0.0.1",
                    instanceName: "dummy-gcp"
                }
            },
        }
        
        assert.deepEqual(state, expectState)

        gcpClientStub.restore()
        pairStub.restore()
        pulumiClientConfigStub.restore()
        pulumiClientUpStub.restore()
        ansibleStub.restore()
        
    })
})
    

