import * as assert from 'assert'
import { fromBase64, toBase64 } from '../../../src/tools/base64'

describe('Base64 utils', () => {

    const expectUtf8String = "dummy-string-test-123"
    const expectBase64String = "ZHVtbXktc3RyaW5nLXRlc3QtMTIz"

    it('should encode a string to base64', () => {
        const actualBase64String = toBase64(expectUtf8String)

        assert.equal(actualBase64String, expectBase64String)
    })

    it('should decode a base64 string to a string', () => {
        const actualUtf8String = fromBase64(expectBase64String)
        assert.equal(actualUtf8String, expectUtf8String)
    })
})