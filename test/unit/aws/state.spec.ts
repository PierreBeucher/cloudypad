import { loadRawState } from "../utils"

import * as assert from 'assert'
import { AwsStateParser } from '../../../src/providers/aws/state'


describe('AwsStateParser', function () {
    const parser = new AwsStateParser()

    it('should parse a valid AWS state', function () {
        const rawState = loadRawState('aws-dummy')
        const parsedState = parser.parse(rawState)
        assert.deepEqual(parsedState, rawState)
    })

    it('should throw an error for a non-AWS state', function () {
        const rawState = loadRawState('azure-dummy')
        assert.throws(() => {
            parser.parse(rawState)
        }, /Coulnd't parse provided State with Zod/)
    })
})