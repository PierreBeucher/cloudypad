import * as path from 'path'
import * as assert from 'assert'
import fs from 'fs';
import { StateLoader } from '../../../../src/core/state/loader';
import { StateMigrator } from '../../../../src/core/state/migrator';

// Test loading a V0 State result in a proper transition to V1 state
describe('State Manager version migration', () => {

    async function compareV0toV1(instanceName: string){
        const v1Dir = path.resolve(__dirname, "v1-root-data-dir")
        const originalV0Dir = path.resolve(__dirname, "v0-root-data-dir")
        const tempV0Dir = path.resolve(__dirname, "TMP-v0-root-data-dir")

        // Ensure the temporary directory is clean
        if (fs.existsSync(tempV0Dir)) {
            fs.rmSync(tempV0Dir, { recursive: true })
        }

        // Create a deep copy of the original directory where migration and file deletion will happen
        fs.cpSync(originalV0Dir, tempV0Dir, { recursive: true })

        const migrator = new StateMigrator({ 
            dataRootDir: tempV0Dir
        })
    
        assert.equal(await migrator.needMigration(instanceName), true)

        // Should migrate state in V0 folder
        await migrator.ensureInstanceStateV1(instanceName)

        const loaderV0 = new StateLoader({ 
            dataRootDir: path.resolve(tempV0Dir)
        })

        const loaderV1 = new StateLoader({ 
            dataRootDir: v1Dir
        })

        const result = await loaderV0.loadInstanceStateSafe(instanceName)
        const expected = await loaderV1.loadInstanceStateSafe(instanceName)
        assert.deepEqual(result, expected)

        // Check old state has been deleted
        const oldStatePath = path.join(tempV0Dir, "instances", instanceName, "config.yml")
        const oldStateExists = fs.existsSync(oldStatePath)
        assert.equal(oldStateExists, false, `Old state should have been deleted but still exists at ${oldStatePath}`)
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

})

