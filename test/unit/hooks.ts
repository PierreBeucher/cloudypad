import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import sinon from 'sinon';
import { AwsPulumiClient, AwsPulumiOutput } from '../../src/tools/pulumi/aws';
import { AnsibleClient } from '../../src/tools/ansible';
import { InstancePulumiClient } from '../../src/tools/pulumi/client';
import { AbstractInstanceRunner } from '../../src/core/runner';
import { AbstractInstanceProvisioner } from '../../src/core/provisioner';
import { DataHomeUtils } from '../../src/core/data';
import { AzurePulumiClient, AzurePulumiOutput } from '../../src/tools/pulumi/azure';
import { GcpPulumiClient, GcpPulumiOutput } from '../../src/tools/pulumi/gcp';
import { PaperspaceClient, PaperspaceMachine } from '../../src/providers/paperspace/client/client';

export const mochaHooks = {
    async beforeAll() {
        console.info("Before hook: stub all side effects for unit tests")

        //
        // Stub side effects
        //

        // Common and abstract classes
        sinon.stub(InstancePulumiClient.prototype, 'preview').resolves()
        sinon.stub(InstancePulumiClient.prototype, 'destroy').resolves()
        sinon.stub(InstancePulumiClient.prototype, 'setConfig').resolves()

        sinon.stub(AbstractInstanceRunner.prototype, 'stop').resolves()
        sinon.stub(AbstractInstanceRunner.prototype, 'start').resolves()
        sinon.stub(AbstractInstanceRunner.prototype, 'pair').resolves()

        sinon.stub(AbstractInstanceProvisioner.prototype, 'verifyConfig').resolves()
        // don't sub provision() and destroy() as they have logic we want to test

        // Write everything under temp directory
        const tmpDir = await mkdtemp(tmpdir())
        sinon.stub(DataHomeUtils, 'getDataDirPath').callsFake(() => tmpDir)

        sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        // AWS
        const dummyAwsPulumiOutput: AwsPulumiOutput = { instanceId: "i-0123456789", publicIp: "127.0.0.1" }
        sinon.stub(AwsPulumiClient.prototype, 'up').resolves(dummyAwsPulumiOutput)

        // Azure
        const dummyAzurePulumiOutput: AzurePulumiOutput = { vmName: "dummy-az", publicIp: "127.0.0.1", resourceGroupName: "dummy-rg"}
        sinon.stub(AzurePulumiClient.prototype, 'up').resolves(dummyAzurePulumiOutput)

        // GCP
        const dummyGcpPulumiOutput: GcpPulumiOutput = { instanceName: "dummy-gcp", publicIp: "127.0.0.1"}
        sinon.stub(GcpPulumiClient.prototype, 'up').resolves(dummyGcpPulumiOutput)

        // Paperspace
        const dummyMachine: PaperspaceMachine = {
            id: "machine-123456788",
            name: "test-machine",
            state: "running",
            machineType: "RTX4000",
            privateIp: "192.168.0.10",
            publicIp: "127.0.0.1",
            publicIpType: "static"
        }
        sinon.stub(PaperspaceClient.prototype, 'createMachine').resolves(dummyMachine)
    }
}
