import * as assert from 'assert'
import * as path from 'path'
import { StateLoader } from '../../../../src/core/state/loader'
import * as yaml from 'js-yaml'
import * as fs from 'fs'
import { AwsInstanceStateV1 } from '../../../../src/providers/aws/state'
import { createTempTestDir, DUMMY_V0_ROOT_DATA_DIR, loadDumyAnonymousStateV1, loadRawDummyStateV0, loadRawDummyStateV1 } from '../../utils'
import { LocalStateSideEffect } from '../../../../src/core/state/local/side-effect'

describe('StateLoader', function () {

    function createLoader(dataRootDir?: string) {
        return new StateLoader({
            sideEffect: new LocalStateSideEffect({ 
                dataRootDir: dataRootDir ?? path.resolve(__dirname, 'v1-root-data-dir')
            })
        })
    }

    describe('listInstances()', function () {
        
        it('should list all instance directories with valid state files', function () {
            const loader = createLoader()
            const instances = loader.listInstances()

            const expectedInstances = [
                'aws-dummy', 
                'azure-dummy', 
                'gcp-dummy', 
                'paperspace-dummy', 
                'missing-state-file', 
                'wrong-state-version',
                'scaleway-dummy'
            ]
            assert.deepStrictEqual(instances.sort(), expectedInstances.sort())
        })

        it('should list no instances without error with empty data root dir', function () {
            const loader = createLoader(createTempTestDir("state-loader-list-empty"))
            const emptyInstances = loader.listInstances()

            assert.equal(emptyInstances.length, 0)
        })
    })

    describe('instanceExists()', function () {
        
        it('should return true for existing instance with valid state file', async function () {
            const loader = createLoader()
            const exists = await loader.instanceExists('aws-dummy')
            assert.strictEqual(exists, true)
        })

        it('should return false for non-existing instance', async function () {
            const loader = createLoader()
            const exists = await loader.instanceExists('nonexistent-instance')
            assert.strictEqual(exists, false)
        })

        it('should return false if state file is missing', async function () {
            const loader = createLoader(path.resolve(__dirname, 'v1-root-data-dir-with-missing-state'))
            const exists = await loader.instanceExists('missing-state-instance')
            assert.strictEqual(exists, false)
        })
    })

    describe('loadInstanceStateSafe()', function () {
        
        it('should load and parse state for a valid instance', async function () {
            const loader = createLoader()
            const parsedState = await loader.loadInstanceState('aws-dummy')

            const expectedState = yaml.load(fs.readFileSync(
                path.resolve(__dirname, 'v1-root-data-dir/instances/aws-dummy/state.yml'),
                'utf-8'
            )) as AwsInstanceStateV1

            assert.deepEqual(parsedState, expectedState)
        })

        it('should throw an error for unsupported state version', async function () {
            const loader = createLoader()

            await assert.rejects(async () => {
                await loader.loadInstanceState('wrong-state-version')
            }, /Unknown state version/)
        })
    })
})
