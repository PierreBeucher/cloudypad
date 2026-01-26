import * as assert from 'assert'
import { linodeLabel } from '../../../../src/providers/linode/pulumi/utils'

describe('linodeLabel', () => {
  it('should handle very long names with special characters', () => {
    const longName = 'this.is.a-VERY-long-instance-name-that-exceeds-50-characters-with-special@chars#here'
    const result = linodeLabel(longName, '-vol')
    const expected = 'this-is-a-very-long-insaa962-vol'
    assert.strictEqual(result, expected)
  })

  it('should handle shorter strings with special characters', () => {
    const shortName = 'test@name#123!with%chars'
    const result = linodeLabel(shortName, '-server')
    const expected = 'test-name-123-with-chars-server'
    assert.strictEqual(result, expected)
  })
})

