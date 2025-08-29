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
import { InstanceEventEnum } from '../../../../src/core/state/state'
import { AnonymousStateParser, GenericStateParser } from '../../../../src/core/state/parser'
import { DummyInstanceStateV1, DummyStateParser } from '../../../../src/providers/dummy/state'
import { CLOUDYPAD_VERSION } from '../../../../src/core/const'

describe('StateWriter', function () {

    const testInstanceName = "dummy-provider-state"

    // create a test writer using a temp directory as data dir
    async function getTestWriter(): Promise<{ dataDir: string, writer: StateWriter<DummyInstanceStateV1> }> {
        const dataDir = mkdtempSync(path.join(tmpdir(), 'statewriter-test-'))

        // load a dummy state and copy it into our test writer
        const loader = new StateLoader({ 
            sideEffect: new LocalStateSideEffect({ dataRootDir: DUMMY_V1_ROOT_DATA_DIR})
        })
        const state = await loader.loadInstanceState(testInstanceName)
        const dummyState = new DummyStateParser().parse(state)

        // create a test writer and persist the state
        const writer = new StateWriter<DummyInstanceStateV1>({
            sideEffect: new LocalStateSideEffect({ dataRootDir: dataDir }),
            stateParser: new DummyStateParser()
        })
        await writer.setState(dummyState)

        return { dataDir: dataDir, writer: writer }
    }

    // Load state from given data dir to compare with expected result
    function loadResultPersistedState(dataDir: string){
        const filePath = path.resolve(path.join(dataDir, "instances", testInstanceName, "state.yml"))
        return yaml.parse(fs.readFileSync(filePath, 'utf-8'))
    }

    it('should write on disk state held in memory', async function () {
        const { dataDir, writer } = await getTestWriter()

        const expected = await writer.getCurrentState(testInstanceName)
        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should update provision input', async function () {
        const { dataDir, writer } = await getTestWriter()

        await writer.updateProvisionInput(testInstanceName, { 
            diskSize: 999,
        })

        const clonedState = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            clonedState,
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

        await writer.updateConfigurationInput(testInstanceName, { 
            dummyConfig: "bar",
        })

        const clonedState = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            clonedState,
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

        const currentState = await writer.getCurrentState(testInstanceName)

        const newProvInput = { 
            ...currentState.provision.input,
            diskSize: 1234,
            instanceType: "g5.xlarge"
        }
        await writer.setProvisionInput(testInstanceName, newProvInput)

        const stateAfterUpdate = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            stateAfterUpdate,
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

        const currentState = await writer.getCurrentState(testInstanceName)

        const newConfInput = { 
            ...currentState.configuration.input,
            dummyConf: "foo",
        }
        await writer.setConfigurationInput(testInstanceName, newConfInput)

        const stateAfterUpdate = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            stateAfterUpdate,
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

        const expectedOutput: DummyInstanceStateV1['configuration']['output'] = {
            configuredAt: new Date("2025-01-01T01:00:00Z").getTime(),
            dataDiskConfigured: true,
        }

        await writer.setConfigurationOutput(testInstanceName, expectedOutput)

        const clonedState = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            clonedState,
            {
                configuration: {
                    output: expectedOutput
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should set provision output', async function () {
        const { dataDir, writer } = await getTestWriter()

        const expectedOutput: DummyInstanceStateV1['provision']['output'] = {
            host: "1.2.3.4",
            publicIPv4: "1.2.3.4",
            instanceId: "i-123456758",
            provisionedAt: new Date("2025-01-01T01:00:00Z").getTime(),
            dataDiskId: "ssd-123456758",
        }

        await writer.setProvisionOutput(testInstanceName, expectedOutput)

        const clonedState = await writer.getCurrentState(testInstanceName)
        const expected = lodash.merge(
            clonedState,
            {
                provision: {
                    output: expectedOutput
                }
            }
        )

        const result = loadResultPersistedState(dataDir)
        assert.deepStrictEqual(expected, result)
    })

    it('should destroy state', async function () {
        const { dataDir, writer } = await getTestWriter()

        // check if state file exists
        const stateDirPath = path.resolve(path.join(dataDir, "instances", testInstanceName))
        const stateFilePath = path.resolve(path.join(stateDirPath, "state.yml"))
        assert.ok(fs.existsSync(stateFilePath))
        assert.ok(fs.existsSync(stateDirPath))

        // Call the destroyState method
        await writer.destroyState(testInstanceName)

        // Check state file and parent dir no longer exists
        const fileExists = fs.existsSync(stateFilePath)
        assert.strictEqual(fileExists, false)

        const parentDirExists = fs.existsSync(stateDirPath)
        assert.strictEqual(parentDirExists, false)
    })

    it('should add event to state (up to max events)', async function () {
        const { dataDir, writer } = await getTestWriter()
        const eventDate = new Date("2025-01-01T01:00:00Z")

        // try to load without events
        const rawStateNoEvent = await loadResultPersistedState(dataDir)
        const stateParser = new AnonymousStateParser()
        const stateNoEvent = stateParser.parse(rawStateNoEvent)
        assert.ok(stateNoEvent.events === undefined)

        // add a single event
        await writer.addEvent(testInstanceName, InstanceEventEnum.ProvisionBegin, eventDate)

        const rawStateOneEvent = await loadResultPersistedState(dataDir)
        const stateOneEvent = stateParser.parse(rawStateOneEvent)
        assert.strictEqual(stateOneEvent.events?.length, 1)
        assert.strictEqual(stateOneEvent.events?.[0].type, InstanceEventEnum.ProvisionBegin)

        // add 9 more events (max 10)
        await writer.addEvent(testInstanceName, InstanceEventEnum.ProvisionEnd,       new Date(eventDate.getTime() + 1))
        await writer.addEvent(testInstanceName, InstanceEventEnum.ConfigurationBegin, new Date(eventDate.getTime() + 2))
        await writer.addEvent(testInstanceName, InstanceEventEnum.ConfigurationEnd,   new Date(eventDate.getTime() + 3))
        await writer.addEvent(testInstanceName, InstanceEventEnum.StartBegin,         new Date(eventDate.getTime() + 4))
        await writer.addEvent(testInstanceName, InstanceEventEnum.StartEnd,           new Date(eventDate.getTime() + 5))
        await writer.addEvent(testInstanceName, InstanceEventEnum.StopBegin,          new Date(eventDate.getTime() + 6))
        await writer.addEvent(testInstanceName, InstanceEventEnum.StopEnd,            new Date(eventDate.getTime() + 7))
        await writer.addEvent(testInstanceName, InstanceEventEnum.DestroyBegin,       new Date(eventDate.getTime() + 8))
        await writer.addEvent(testInstanceName, InstanceEventEnum.DestroyEnd,         new Date(eventDate.getTime() + 9))

        const rawStateTenEvents = await loadResultPersistedState(dataDir)
        const stateTenEvents = stateParser.parse(rawStateTenEvents)
        assert.ok(stateTenEvents.events)
        assert.strictEqual(stateTenEvents.events?.length, 10)

        const tenEvents = lodash.cloneDeep(stateTenEvents.events)
        tenEvents.sort((a, b) => a.timestamp - b.timestamp)
        assert.strictEqual(tenEvents[0].type, InstanceEventEnum.ProvisionBegin)
        assert.strictEqual(tenEvents[0].timestamp, eventDate.getTime())
        assert.strictEqual(tenEvents[1].type, InstanceEventEnum.ProvisionEnd)
        assert.strictEqual(tenEvents[1].timestamp, eventDate.getTime() + 1)
        assert.strictEqual(tenEvents[2].type, InstanceEventEnum.ConfigurationBegin)
        assert.strictEqual(tenEvents[2].timestamp, eventDate.getTime() + 2)
        assert.strictEqual(tenEvents[3].type, InstanceEventEnum.ConfigurationEnd)
        assert.strictEqual(tenEvents[3].timestamp, eventDate.getTime() + 3)
        assert.strictEqual(tenEvents[4].type, InstanceEventEnum.StartBegin)
        assert.strictEqual(tenEvents[4].timestamp, eventDate.getTime() + 4)
        assert.strictEqual(tenEvents[5].type, InstanceEventEnum.StartEnd)
        assert.strictEqual(tenEvents[5].timestamp, eventDate.getTime() + 5)
        assert.strictEqual(tenEvents[6].type, InstanceEventEnum.StopBegin)
        assert.strictEqual(tenEvents[6].timestamp, eventDate.getTime() + 6)
        assert.strictEqual(tenEvents[7].type, InstanceEventEnum.StopEnd)
        assert.strictEqual(tenEvents[7].timestamp, eventDate.getTime() + 7)
        assert.strictEqual(tenEvents[8].type, InstanceEventEnum.DestroyBegin)
        assert.strictEqual(tenEvents[8].timestamp, eventDate.getTime() + 8)
        assert.strictEqual(tenEvents[9].type, InstanceEventEnum.DestroyEnd)
        assert.strictEqual(tenEvents[9].timestamp, eventDate.getTime() + 9)

        // add 11th event, should remove oldest event
        await writer.addEvent(testInstanceName, InstanceEventEnum.ProvisionBegin, new Date(eventDate.getTime() + 10))
        const rawStateElevenEvents = await loadResultPersistedState(dataDir)
        const stateElevenEvents = stateParser.parse(rawStateElevenEvents)

        assert.ok(stateElevenEvents.events)
        assert.strictEqual(stateElevenEvents.events?.length, 10)

        const elevenEvents = lodash.cloneDeep(stateElevenEvents.events)
        elevenEvents.sort((a, b) => a.timestamp - b.timestamp)

        // oldest event should be removed
        assert.strictEqual(elevenEvents[0].type, InstanceEventEnum.ProvisionEnd)
        assert.strictEqual(elevenEvents[0].timestamp, eventDate.getTime() + 1)

        assert.strictEqual(elevenEvents[1].type, InstanceEventEnum.ConfigurationBegin)
        assert.strictEqual(elevenEvents[1].timestamp, eventDate.getTime() + 2)

        assert.strictEqual(elevenEvents[9].type, InstanceEventEnum.ProvisionBegin)
        assert.strictEqual(elevenEvents[9].timestamp, eventDate.getTime() + 10)

        // again add 11th event, should remove oldest event
        await writer.addEvent(testInstanceName, InstanceEventEnum.ProvisionEnd, new Date(eventDate.getTime() + 11))
        const rawStateTwelveEvents = await loadResultPersistedState(dataDir)
        const stateTwelveEvents = stateParser.parse(rawStateTwelveEvents)
        assert.ok(stateTwelveEvents.events)
        assert.strictEqual(stateTwelveEvents.events?.length, 10)

        const twelveEvents = lodash.cloneDeep(stateTwelveEvents.events)
        twelveEvents.sort((a, b) => a.timestamp - b.timestamp)
        assert.strictEqual(twelveEvents[0].type, InstanceEventEnum.ConfigurationBegin)
        assert.strictEqual(twelveEvents[0].timestamp, eventDate.getTime() + 2)

        assert.strictEqual(twelveEvents[1].type, InstanceEventEnum.ConfigurationEnd)
        assert.strictEqual(twelveEvents[1].timestamp, eventDate.getTime() + 3)

        assert.strictEqual(twelveEvents[9].type, InstanceEventEnum.ProvisionEnd)
        assert.strictEqual(twelveEvents[9].timestamp, eventDate.getTime() + 11)
    })

    it('should update metadata when setting provision and configuration outputs', async function () {
        const { dataDir, writer } = await getTestWriter()

        // Set provision output and check metadata
        const provisionOutput: DummyInstanceStateV1['provision']['output'] = {
            host: "1.2.3.4",
            publicIPv4: "1.2.3.4",
            instanceId: "i-123456758",
            provisionedAt: new Date("2025-01-01T01:00:00Z").getTime(),
            dataDiskId: "ssd-123456758",
        }
        await writer.setProvisionOutput(testInstanceName, provisionOutput)

        const stateAfterProvision = await writer.getCurrentState(testInstanceName)
        assert.ok(stateAfterProvision.metadata?.lastProvisionDate)
        assert.strictEqual(stateAfterProvision.metadata?.lastProvisionCloudypadVersion, CLOUDYPAD_VERSION)
        assert.ok(!stateAfterProvision.metadata?.lastConfigurationDate)
        assert.ok(!stateAfterProvision.metadata?.lastConfigurationCloudypadVersion)

        // Set configuration output and check metadata (provision metadata should still be there)
        const configurationOutput: DummyInstanceStateV1['configuration']['output'] = {
            configuredAt: new Date("2025-01-01T02:00:00Z").getTime(),
            dataDiskConfigured: true,
        }
        await writer.setConfigurationOutput(testInstanceName, configurationOutput)

        const stateAfterConfiguration = await writer.getCurrentState(testInstanceName)
        assert.ok(stateAfterConfiguration.metadata?.lastProvisionDate)
        assert.strictEqual(stateAfterConfiguration.metadata?.lastProvisionCloudypadVersion, CLOUDYPAD_VERSION)
        assert.ok(stateAfterConfiguration.metadata?.lastConfigurationDate)
        assert.strictEqual(stateAfterConfiguration.metadata?.lastConfigurationCloudypadVersion, CLOUDYPAD_VERSION)

        // Set provision output again and check configuration metadata still there
        const newProvisionOutput: DummyInstanceStateV1['provision']['output'] = {
            host: "5.6.7.8",
            instanceId: "i-87654321",
            provisionedAt: new Date("2025-01-01T03:00:00Z").getTime(),
            dataDiskId: "ssd-87654321",
        }
        await writer.setProvisionOutput(testInstanceName, newProvisionOutput)

        const stateAfterSecondProvision = await writer.getCurrentState(testInstanceName)
        assert.ok(stateAfterSecondProvision.metadata?.lastProvisionDate)
        assert.strictEqual(stateAfterSecondProvision.metadata?.lastProvisionCloudypadVersion, CLOUDYPAD_VERSION)
        assert.ok(stateAfterSecondProvision.metadata?.lastConfigurationDate)
        assert.strictEqual(stateAfterSecondProvision.metadata?.lastConfigurationCloudypadVersion, CLOUDYPAD_VERSION)
    })

    
})