import * as assert from 'assert'
import { StateParser } from '../../../../src/core/state/parser'
import yaml from 'js-yaml'
import * as fs from 'fs'
import * as path from 'path'

describe('StateParser', function () {

    const parser = new StateParser()

    function loadRawState(fileName: string): unknown {
        const filePath = path.resolve(__dirname, 'v1-root-data-dir/instances', fileName, 'state.yml')
        return yaml.load(fs.readFileSync(filePath, 'utf-8'))
    }

    describe('parseAnyStateV1()', function () {
        
        it('should parse a valid AWS state', function () {
            const rawState = loadRawState('aws-dummy')
            const parsedState = parser.parseAnyStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Azure state', function () {
            const rawState = loadRawState('azure-dummy')
            const parsedState = parser.parseAnyStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid GCP state', function () {
            const rawState = loadRawState('gcp-dummy')
            const parsedState = parser.parseAnyStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Paperspace state', function () {
            const rawState = loadRawState('paperspace-dummy')
            const parsedState = parser.parseAnyStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for an invalid state', function () {
            const rawState = loadRawState('wrong-state-version')
            assert.throws(() => {
                parser.parseAnyStateV1(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })

    describe('parseAwsStateV1()', function () {
        it('should parse a valid AWS state', function () {
            const rawState = loadRawState('aws-dummy')
            const parsedState = parser.parseAwsStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for a non-AWS state', function () {
            const rawState = loadRawState('azure-dummy')
            assert.throws(() => {
                parser.parseAwsStateV1(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })

    describe('parseAzureStateV1()', function () {
        it('should parse a valid Azure state', function () {
            const rawState = loadRawState('azure-dummy')
            const parsedState = parser.parseAzureStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for a non-Azure state', function () {
            const rawState = loadRawState('aws-dummy')
            assert.throws(() => {
                parser.parseAzureStateV1(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })

    describe('parseGcpStateV1()', function () {
        it('should parse a valid GCP state', function () {
            const rawState = loadRawState('gcp-dummy')
            const parsedState = parser.parseGcpStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for a non-GCP state', function () {
            const rawState = loadRawState('paperspace-dummy')
            assert.throws(() => {
                parser.parseGcpStateV1(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })

    describe('parsePaperspaceStateV1()', function () {
        it('should parse a valid Paperspace state', function () {
            const rawState = loadRawState('paperspace-dummy')
            const parsedState = parser.parsePaperspaceStateV1(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for a non-Paperspace state', function () {
            const rawState = loadRawState('gcp-dummy')
            assert.throws(() => {
                parser.parsePaperspaceStateV1(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })
})
