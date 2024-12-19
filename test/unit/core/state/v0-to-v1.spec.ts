import * as path from 'path'
import * as assert from 'assert'
import fs from 'fs';
import { StateManager } from "../../../../src/core/state/manager"
import sinon from 'sinon'
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Test loading a V0 State result in a proper transition to V1 state
describe('State Manager version migration', () => {

    async function compareV0toV1(name: string){
        const smV0 = new StateManager({ 
            dataRootDir: path.resolve(__dirname, "v0-root-data-dir")
        })

        const smV1 = new StateManager({ 
            dataRootDir: path.resolve(__dirname, "v1-root-data-dir")
        })

        // Avoid deletion of legacy state but spy to check deletion did happen
        const v0PersisStub = sinon.stub(smV0, "persistState")
        const v0removeInstanceStateV0Stub = sinon.stub(smV0, "removeInstanceStateV0")

        // Should load aws v0 state into a v1 state
        const result = await smV0.loadInstanceStateSafe(name)

        // Load the expected v1 state and compare
        const expected = await smV1.loadInstanceStateSafe(name)

        assert.deepEqual(result, expected)
        assert.ok(v0PersisStub.callCount == 1, "Legacy state should have been persisted on disk once")
        assert.ok(v0removeInstanceStateV0Stub.callCount == 1, "Legacy state deletion should have been called one")
    }
    
    it('should convert AWS V0 state to V1', async () => {
        await compareV0toV1("aws-dummy")
    })

    it('should convert Azure V0 state to V1', async () => {
        await compareV0toV1("azure-dummy")
    })

    it('should convert GCP V0 state to V1', async () => {
        await compareV0toV1("gcp-dummy")
    })

    it('should convert Paperspace V0 state to V1', async () => {
        await compareV0toV1("paperspace-dummy")
    })

    it('perform V0 to V1 migration on state load, persist new state and delete old state', async () => {
        
        // Prepare dummy root data dir 
        const tmpDir = await mkdtemp(tmpdir())
        const instanceName = 'aws-dummy'
        const tmpInstanceDir = path.join(tmpDir, `instances/${instanceName}`)
        const tmpConfigPath = path.join(tmpInstanceDir, 'config.yml') // V0 state path
        const tmpStatePath = path.join(tmpInstanceDir, 'state.yml') // V1 state path

        // Ensure the directory structure exists
        fs.mkdirSync(tmpInstanceDir, { recursive: true })

        // Copy V0 state config.yml to the temporary directory
        const configSourcePath = path.resolve(__dirname, `v0-root-data-dir/instances/${instanceName}/config.yml`)
        fs.copyFileSync(configSourcePath, tmpConfigPath)

        const smV0 = new StateManager({
            dataRootDir: tmpDir,
        })

        // Load the instance state
        // This should trigger migration, remove old state and create new one
        const returnedStateAfterMigration = await smV0.loadInstanceStateSafe(instanceName)

        assert.ok(!fs.existsSync(tmpConfigPath), `config.yml (V0 state file) should have been deleted. See ${tmpDir}`)
        assert.ok(fs.existsSync(tmpStatePath), `state.yml (V1 state file) should have been created. See ${tmpDir}`)

        // Validate new file content:
        // - Check returned value matches value from another StateManager loading this same state
        // - Compare against expected value
        
        // Load expected value
        const smV1Expected = new StateManager({
            dataRootDir: path.resolve(__dirname, 'v1-root-data-dir'),
        })
        const expected = await smV1Expected.loadInstanceStateSafe(instanceName)

        // Compare returned state with expected value
        assert.deepEqual(returnedStateAfterMigration, expected, 'Return state after migration should match the expected state')

        // Load again from disk to see if state on disk matches expected value
        const smV1Check = new StateManager({
            dataRootDir: tmpDir,
        })
        const stateFromDiskAfterMigration = await smV1Check.loadInstanceStateSafe(instanceName)
        assert.deepEqual(stateFromDiskAfterMigration, expected, 'Return state after migration should match the expected state')
    })
})

