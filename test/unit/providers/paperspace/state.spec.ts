import { loadRawDummyStateV1 } from "../../utils"

import * as assert from 'assert'
import { PaperspaceStateParser } from '../../../../src/providers/paperspace/state'


describe('PaperspaceStateParser', function () {
    const parser = new PaperspaceStateParser()

    it('should parse a valid Paperspace state', function () {
        const rawState = loadRawDummyStateV1('paperspace-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-Paperspace state', function () {
        const rawState = loadRawDummyStateV1('azure-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})