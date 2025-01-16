import { loadRawState } from "../utils"

import * as assert from 'assert'
import { GcpStateParser } from '../../../src/providers/gcp/state'


describe('GcpStateParser', function () {
    const parser = new GcpStateParser()

    it('should parse a valid GCP state', function () {
        const rawState = loadRawState('gcp-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-GCP state', function () {
        const rawState = loadRawState('azure-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})