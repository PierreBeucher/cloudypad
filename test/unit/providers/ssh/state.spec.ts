import { loadRawDummyStateV1 } from "../../utils"

import * as assert from 'assert'
import { SshStateParser } from '../../../../src/providers/ssh/state'

describe('SshStateParser', function () {
    const parser = new SshStateParser()

    it('should parse a valid SSH state', function () {
        const rawState = loadRawDummyStateV1('ssh-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-SSH state', function () {
        const rawState = loadRawDummyStateV1('gcp-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})