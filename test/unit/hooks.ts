import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import sinon from 'sinon';
import path from 'path';
import { AwsPulumiClient } from '../../src/providers/aws/pulumi';
import { AnsibleClient } from '../../src/tools/ansible';
import { InstancePulumiClient } from '../../src/tools/pulumi/client';
import { AbstractInstanceRunner } from '../../src/core/runner';
import { AbstractInstanceProvisioner } from '../../src/core/provisioner';
import { AzurePulumiClient } from '../../src/providers/azure/pulumi';
import { GcpPulumiClient } from '../../src/providers/gcp/pulumi';
import { PaperspaceClient, PaperspaceMachine } from '../../src/providers/paperspace/client/client';
import { DUMMY_AWS_PULUMI_OUTPUT, DUMMY_AZURE_PULUMI_OUTPUT, DUMMY_GCP_PULUMI_OUTPUT, DUMMY_PAPERSPACE_MACHINE } from './utils';
import { DataRootDirManager } from '../../src/core/data-dir';
import { AnalyticsManager } from '../../src/tools/analytics/manager';
import { NoOpAnalyticsClient } from '../../src/tools/analytics/client';
import { SshKeyLoader } from '../../src/tools/ssh';


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
        sinon.stub(AbstractInstanceRunner.prototype, 'pairSendPin').resolves()
        sinon.stub(AbstractInstanceRunner.prototype, 'pairInteractive').resolves()

        sinon.stub(AbstractInstanceProvisioner.prototype, 'verifyConfig').resolves()
        // don't sub provision() and destroy() as they have logic we want to test

        // Force environment data root dir to a temp directory for unit tests
        const dummyCloudyPadHome = mkdtempSync(path.join(tmpdir(), ".cloudypad-unit-tests"))
        sinon.stub(DataRootDirManager, 'getEnvironmentDataRootDir').callsFake(() => {
            return dummyCloudyPadHome
        })

        // Force dummy analytics client
        // We don't want tests to send dummy data
        sinon.stub(AnalyticsManager, 'get').callsFake(() => {
            return new NoOpAnalyticsClient()
        })

        // Force dummy ssh key loader
        sinon.stub(SshKeyLoader.prototype, 'parseSshPrivateKeyFileToPublic').resolves()

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
