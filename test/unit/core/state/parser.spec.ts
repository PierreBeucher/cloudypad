import * as assert from 'assert'
import { AnonymousStateParser } from '../../../../src/core/state/parser'
import { loadRawDummyStateV1 } from '../../utils'

describe('AnonymousStateParser', function () {

    const parser = new AnonymousStateParser()

    describe('parse anonymous state', function () {
        
        it('should parse a valid AWS state', function () {
            const rawState = loadRawDummyStateV1('aws-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Azure state', function () {
            const rawState = loadRawDummyStateV1('azure-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid GCP state', function () {
            const rawState = loadRawDummyStateV1('gcp-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Paperspace state', function () {
            const rawState = loadRawDummyStateV1('paperspace-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for an invalid state', function () {
            const rawState = loadRawDummyStateV1('wrong-state-version')
            assert.throws(() => {
                parser.parse(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })

        it('should throw an error for a schema mismatch', function () {
            const rawState = { invalidKey: "invalidValue" }
            assert.throws(() => {
                parser.parse(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })
})
