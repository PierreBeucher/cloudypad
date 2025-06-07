import * as assert from 'assert'
import * as path from 'path'
import { StateLoader } from '../../../../src/core/state/loader'
import * as yaml from 'yaml'
import * as fs from 'fs'
import { AwsInstanceStateV1 } from '../../../../src/providers/aws/state'
import { createTempTestDir, DUMMY_V1_ROOT_DATA_DIR } from '../../utils'
import { LocalStateSideEffect } from '../../../../src/core/state/side-effects/local'

describe('StateLoader', function () {

    function createLoader(dataRootDir?: string) {
        return new StateLoader({
            sideEffect: new LocalStateSideEffect({ 
                dataRootDir: dataRootDir ?? DUMMY_V1_ROOT_DATA_DIR
            })
        })
    }

    describe('listInstances()', function () {
        
        it('should list all instance directories with valid state files', async function () {
            const loader = createLoader()
            const instances = await loader.listInstances()

            const expectedInstances = [
                'dummy-provider-state',
                'aws-dummy', 
                'azure-dummy', 
                'gcp-dummy', 
                'invalid-state',
                'paperspace-dummy', 
                'missing-state-file', 
                'wrong-state-version',
                'wrong-state-both-ssh-key',
                'wrong-state-no-ssh-key',
                'scaleway-dummy'
            ]
            assert.deepStrictEqual(instances.sort(), expectedInstances.sort())
        })

        it('should list no instances without error with empty data root dir', async function () {
            const loader = createLoader(createTempTestDir("state-loader-list-empty"))
            const emptyInstances = await loader.listInstances()

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
            const loader = createLoader(createTempTestDir("state-loader-missing-state"))
            const exists = await loader.instanceExists('missing-state-instance')
            assert.strictEqual(exists, false)
        })
    })

    describe('loadInstanceState()', function () {
        
        it('should load and parse state for a valid instance', async function () {
            const loader = createLoader()
            const parsedState = await loader.loadInstanceState('aws-dummy')

            const expectedState = yaml.parse(fs.readFileSync(
                path.resolve(DUMMY_V1_ROOT_DATA_DIR, 'instances/aws-dummy/state.yml'),
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

        it('should throw an error if state file is invalid', async function () {
            const loader = createLoader(DUMMY_V1_ROOT_DATA_DIR)

            await assert.rejects(async () => {
                await loader.loadInstanceState('invalid-state')
            }, /Coulnd't parse provided State with Zod/)
        })
    })
})
