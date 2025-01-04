import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import sinon from 'sinon';
import path from 'path';
import { AwsPulumiClient } from '../../src/tools/pulumi/aws';
import { AnsibleClient } from '../../src/tools/ansible';
import { InstancePulumiClient } from '../../src/tools/pulumi/client';
import { AbstractInstanceRunner } from '../../src/core/runner';
import { AbstractInstanceProvisioner } from '../../src/core/provisioner';
import { AzurePulumiClient } from '../../src/tools/pulumi/azure';
import { GcpPulumiClient } from '../../src/tools/pulumi/gcp';
import { PaperspaceClient, PaperspaceMachine } from '../../src/providers/paperspace/client/client';
import { BaseStateManager } from '../../src/core/state/base-manager';
import { DUMMY_AWS_PULUMI_OUTPUT, DUMMY_AZURE_PULUMI_OUTPUT, DUMMY_GCP_PULUMI_OUTPUT, DUMMY_PAPERSPACE_MACHINE } from './utils';


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

        // Force environment data root dir to a temp directory for unit tests
        const dummyCloudyPadHome = mkdtempSync(path.join(tmpdir(), ".cloudypad-unit-tests"))
        sinon.stub(DataRootDirManager, 'getEnvironmentDataRootDir').callsFake(() => {
            return dummyCloudyPadHome
        })

        sinon.stub(AnsibleClient.prototype, 'runAnsible').resolves()

        // AWS
        sinon.stub(AwsPulumiClient.prototype, 'up').resolves(DUMMY_AWS_PULUMI_OUTPUT)

        // Azure
        sinon.stub(AzurePulumiClient.prototype, 'up').resolves(DUMMY_AZURE_PULUMI_OUTPUT)

        // GCP
        sinon.stub(GcpPulumiClient.prototype, 'up').resolves(DUMMY_GCP_PULUMI_OUTPUT)

        // Paperspace
        const dummyMachine: PaperspaceMachine = DUMMY_PAPERSPACE_MACHINE

        sinon.stub(PaperspaceClient.prototype, 'createMachine').resolves(dummyMachine)
    }
}
