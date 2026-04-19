import * as assert from 'assert'
import { generateStrongPassword } from '../../../src/tools/password'

describe('generateStrongPassword', () => {

    it('should generate a non-empty string', () => {
        const pwd = generateStrongPassword()
        assert.ok(pwd.length > 0)
    })

    it('should generate a base64url string of 32 chars with default 24 bytes', () => {
        const pwd = generateStrongPassword()
        assert.equal(pwd.length, 32)
        assert.match(pwd, /^[A-Za-z0-9_-]+$/)
    })

    it('should generate a string with expected length for given byte length', () => {
        const pwd = generateStrongPassword(18)
        assert.equal(pwd.length, 24)
        assert.match(pwd, /^[A-Za-z0-9_-]+$/)
    })

    it('should generate different passwords on successive calls', () => {
        const pwd1 = generateStrongPassword()
        const pwd2 = generateStrongPassword()
        assert.notEqual(pwd1, pwd2)
    })
})
