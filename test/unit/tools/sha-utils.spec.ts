import * as assert from 'assert'
import { ShaUtils } from '../../../src/tools/sha-utils'

describe('ShaUtils', () => {
  it('should always generate names within the specified maxLength limit', () => {
    const longBaseName = 'this-is-a-very-long-base-name-that-exceeds-most-reasonable-limits-and-should-trigger-hashing-behavior-in-most-cases'
    const maxLength = 30
    const suffix = '-test'

    // Test with increasingly longer substrings of the long base name
    for (let i = 1; i <= longBaseName.length; i++) {
      const baseName = longBaseName.slice(0, i)
      const result = ShaUtils.createUniqueNameWith({
        baseName,
        maxLength,
        suffix
      })

      // Verify the result never exceeds maxLength
      assert.ok(result.length <= maxLength, 
        `Generated name "${result}" (length: ${result.length}) exceeds maxLength: ${maxLength} for baseName: "${baseName}"`)
      
      // Verify the result always ends with the suffix
      assert.ok(result.endsWith(suffix), 
        `Generated name "${result}" should end with suffix "${suffix}"`)
    }
  })
}) 