import { loadRawDummyStateV1 } from "../utils"

import * as assert from 'assert'
import { ScalewayStateParser } from '../../../src/providers/scaleway/state'

describe('ScalewayStateParser', function () {
    const parser = new ScalewayStateParser()

    it('should parse a valid Scaleway state', function () {
        const rawState = loadRawDummyStateV1('scaleway-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-Scaleway state', function () {
        const rawState = loadRawDummyStateV1('gcp-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})