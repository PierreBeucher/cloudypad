import * as path from 'path'
import * as assert from 'assert';
import { StateManager } from "../../../../src/core/state";

// Test loading a V0 State result in a proper transition to V1 state
describe('State Manager version migration', () => {

    async function compareV0toV1(name: string){
        const smV0 = new StateManager({ 
            dataRootDir: path.resolve(__dirname, "v0-root-data-dir")
        })

        const smV1 = new StateManager({ 
            dataRootDir: path.resolve(__dirname, "v1-root-data-dir")
        })

        // Should load aws v0 state into a v1 state
        const result = await smV0.loadInstanceState(name)

        // Load the expected v1 state and compare
        const expected = await smV1.loadInstanceState(name)

        assert.deepEqual(result, expected)
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
    

