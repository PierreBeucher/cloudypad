import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import yaml from 'js-yaml'
import { StateWriter } from '../../../../src/core/state/writer'
import { StateLoader } from '../../../../src/core/state/loader'
import { AwsInstanceStateV1, AwsStateParser } from '../../../../src/providers/aws/state'
import lodash from 'lodash'

describe('StateWriter', function () {

    const instanceName = "aws-dummy"

    // create a test writer using a temp directory as data dir
    async function getTestWriter(): Promise<{ dataDir: string, writer: StateWriter<AwsInstanceStateV1> }> {
        const dataDir = mkdtempSync(path.join(tmpdir(), 'statewriter-test-'))

        const loader = new StateLoader({ dataRootDir: path.resolve(__dirname, "v1-root-data-dir")})
        const state = await loader.loadInstanceStateSafe(instanceName)
        const awState = new AwsStateParser().parse(state)

        const writer = new StateWriter<AwsInstanceStateV1>({
            state: awState,
            dataRootDir: dataDir
        })

        return { dataDir: dataDir, writer: writer }
    }

    // Load state from given data dir to compare with expected result
    function loadResultPersistedState(dataDir: string){
        const filePath = path.resolve(path.join(dataDir, "instances", instanceName, "state.yml"))
        return yaml.load(fs.readFileSync(filePath, 'utf-8'))
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
            dummyOutput: "bla"
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
    
})
