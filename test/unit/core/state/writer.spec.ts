import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import yaml from 'yaml'
import { StateWriter } from '../../../../src/core/state/writer'
import { StateLoader } from '../../../../src/core/state/loader'
import { AwsInstanceStateV1, AwsStateParser } from '../../../../src/providers/aws/state'
import lodash from 'lodash'
import { LocalStateSideEffect } from '../../../../src/core/state/side-effects/local'
import { DUMMY_V1_ROOT_DATA_DIR } from '../../utils'

describe('StateWriter', function () {

    const instanceName = "aws-dummy"

    // create a test writer using a temp directory as data dir
    async function getTestWriter(): Promise<{ dataDir: string, writer: StateWriter<AwsInstanceStateV1> }> {
        const dataDir = mkdtempSync(path.join(tmpdir(), 'statewriter-test-'))

        // load a dummy state and copy it into our test writer
        const loader = new StateLoader({ 
            sideEffect: new LocalStateSideEffect({ dataRootDir: DUMMY_V1_ROOT_DATA_DIR})
        })
        const state = await loader.loadInstanceState(instanceName)
        const awState = new AwsStateParser().parse(state)

        // create a test writer and persist the state
        const writer = new StateWriter<AwsInstanceStateV1>({
            sideEffect: new LocalStateSideEffect({ dataRootDir: dataDir })
        })
        writer.setState(awState)
        await writer.persistStateNow()

        return { dataDir: dataDir, writer: writer }
    }

    // Load state from given data dir to compare with expected result
    function loadResultPersistedState(dataDir: string){
        const filePath = path.resolve(path.join(dataDir, "instances", instanceName, "state.yml"))
        return yaml.parse(fs.readFileSync(filePath, 'utf-8'))
    }

    it('should write on disk state held in memory', async function () {
        const { dataDir, writer } = await getTestWriter()

        await writer.persistStateNow()

        const expected = writer.cloneState()
        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should update provision input', async function () {
        const { dataDir, writer } = await getTestWriter()

        await writer.updateProvisionInput({ 
            diskSize: 999,
        })

        const expected = lodash.merge(
            writer.cloneState(),
            {
                provision: {
                    input: {
                        diskSize: 999,
                    }
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should update configuration input', async function () {
        const { dataDir, writer } = await getTestWriter()

        await writer.updateConfigurationInput({ 
            dummyConfig: "bar",
        })

        const expected = lodash.merge(
            writer.cloneState(),
            {
                configuration: {
                    input: {
                        dummyConfig: "bar",
                    }
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should set provision input', async function () {
        const { dataDir, writer } = await getTestWriter()

        const newProvInput = { 
            ...writer.cloneState().provision.input,
            diskSize: 1234,
            instanceType: "g5.xlarge"
        }
        await writer.setProvisionInput(newProvInput)

        const expected = lodash.merge(
            writer.cloneState(),
            {
                provision: {
                    input: newProvInput
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should set configuration input', async function () {
        const { dataDir, writer } = await getTestWriter()

        const newConfInput = { 
            ...writer.cloneState().configuration.input,
            dummyConf: "foo",
        }
        await writer.setConfigurationInput(newConfInput)

        const expected = lodash.merge(
            writer.cloneState(),
            {
                configuration: {
                    input: newConfInput
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should set configuration output', async function () {
        const { dataDir, writer } = await getTestWriter()

        const output = {
            dataDiskConfigured: true
        }

        await writer.setConfigurationOutput(output)

        const expected = lodash.merge(
            writer.cloneState(),
            {
                configuration: {
                    output: output
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should set provision output', async function () {
        const { dataDir, writer } = await getTestWriter()

        const output = {
            host: "1.2.3.4",
            instanceId: "i-123456758"
        }

        await writer.setProvisionOutput(output)

        const expected = lodash.merge(
            writer.cloneState(),
            {
                provision: {
                    output: output
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should destroy state', async function () {
        const { dataDir, writer } = await getTestWriter()

        // check if state file exists
        const stateDirPath = path.resolve(path.join(dataDir, "instances", instanceName))
        const stateFilePath = path.resolve(path.join(stateDirPath, "state.yml"))
        assert.ok(fs.existsSync(stateFilePath))
        assert.ok(fs.existsSync(stateDirPath))

        // Call the destroyState method
        await writer.destroyState()

        // Check state file and parent dir no longer exists
        const fileExists = fs.existsSync(stateFilePath)
        assert.strictEqual(fileExists, false)

        const parentDirExists = fs.existsSync(stateDirPath)
        assert.strictEqual(parentDirExists, false)
    })
    
})

