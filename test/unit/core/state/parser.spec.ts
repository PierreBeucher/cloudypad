import * as assert from 'assert'
import { AnonymousStateParser } from '../../../../src/core/state/parser'
import { loadRawState } from '../../utils'

describe('AnonymousStateParser', function () {

    const parser = new AnonymousStateParser()

    describe('parse anonymous state', function () {
        
        it('should parse a valid AWS state', function () {
            const rawState = loadRawState('aws-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Azure state', function () {
            const rawState = loadRawState('azure-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid GCP state', function () {
            const rawState = loadRawState('gcp-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should parse a valid Paperspace state', function () {
            const rawState = loadRawState('paperspace-dummy')
            const parsedState = parser.parse(rawState)
            assert.deepEqual(parsedState, rawState)
        })

        it('should throw an error for an invalid state', function () {
            const rawState = loadRawState('wrong-state-version')
            assert.throws(() => {
                parser.parse(rawState)
            }, /Coulnd't parse provided State with Zod/)
        })
    })
})
