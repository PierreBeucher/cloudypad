import { loadRawDummyStateV1 } from "../utils"

import * as assert from 'assert'
import { AzureStateParser } from '../../../src/providers/azure/state'


describe('AzureStateParser', function () {
    const parser = new AzureStateParser()

    it('should parse a valid Azure state', function () {
        const rawState = loadRawDummyStateV1('azure-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-Azure state', function () {
        const rawState = loadRawDummyStateV1('gcp-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})