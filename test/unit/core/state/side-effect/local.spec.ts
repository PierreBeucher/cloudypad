// test/unit/core/state/side-effects/local.spec.ts
import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { InstanceStateV1 } from '../../../../../src/core/state/state'
import { LocalStateSideEffect } from '../../../../../src/core/state/side-effects/local'
import { createTempTestDir, loadDumyAnonymousStateV1 } from '../../../utils'

describe('LocalStateSideEffect', function () {

    const dataRootDir = createTempTestDir('side-effect-local')

    const expectStateFileDir = path.join(dataRootDir, 'instances', 'aws-dummy')
    const expectStateFilePath = path.join(expectStateFileDir, 'state.yml')

    const sideEffect = new LocalStateSideEffect({ dataRootDir })

    it('should list instances (empty)', function () {
        const instances = sideEffect.listInstances()
        assert.deepStrictEqual(instances, [])
    })

    it('should persist state to disk and load from disk', async function () {
        // use this dummy state forn testing, it will be loaded from test resources, not side effect dir
        const state = loadDumyAnonymousStateV1('aws-dummy')

        // persist and check data written to disk
        await sideEffect.persistState(state)

        assert.ok(fs.existsSync(expectStateFileDir))
        assert.ok(fs.existsSync(expectStateFilePath))

        const stateFileContent = fs.readFileSync(expectStateFilePath, 'utf-8')
        assert.equal(stateFileContent, yaml.dump(state))

        // load and check data loaded from disk
        const loadedState = await sideEffect.loadRawInstanceState('aws-dummy')
        assert.deepStrictEqual(loadedState, state)
    })

    it('should list instances', async function () {

        const stateAws = loadDumyAnonymousStateV1('aws-dummy')
        await sideEffect.persistState(stateAws)

        const instanceListSingle = sideEffect.listInstances()
        assert.deepStrictEqual(instanceListSingle, ['aws-dummy'])

        // add another instance
        const stateAzure = loadDumyAnonymousStateV1('azure-dummy')
        await sideEffect.persistState(stateAzure)

        const instanceList2 = sideEffect.listInstances()
        assert.deepStrictEqual(instanceList2, ['aws-dummy', 'azure-dummy'])
    })

    it('should check if an instance exists', async function () {
        const exists = await sideEffect.instanceExists('aws-dummy')
        assert.strictEqual(exists, true)
    })

    it('should check if an instance does not exist', async function () {
        const exists = await sideEffect.instanceExists('not-exist')
        assert.strictEqual(exists, false)
    })

    it('should throw an error if instance does not exist', async function () {
        await assert.rejects(async () => {
            await sideEffect.loadRawInstanceState('not-exist')
        }, /does not exist/)
    })

    it('should destroy instance state', async function () {
        await sideEffect.destroyState('aws-dummy')
        
        assert.ok(!fs.existsSync(expectStateFileDir))
        assert.ok(!fs.existsSync(expectStateFilePath))
    })
})