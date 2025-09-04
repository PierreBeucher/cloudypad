export class ShaUtils {
    /**
     * Create a unique name with specified max length based on given base name,
     * with optional suffix and hash length.
     * 
     * Generated name will be no longer than maxLength characters:
     * - if baseName.length + suffix.length <= maxLength, return `${baseName}{suffix}`
     * - if baseName.length + suffix.length > maxLength, generate a unique hash based on baseName
     *   and append it to a spliced baseName such as `${splicedBaseName}${hash}${suffix}`
     * 
     * Example:
     *  ```
     *  // result in test-name-with-maf4e5d-zz where f4e5d is a unique hash based on baseName
     *  createUniqueNameWith({ baseName: "test-name-with-max-length-25", maxLength: 25, suffix: "-zz" })
     * 
     *  // result in test-name-with-max-length-25-zz as baseName + suffix is longer than maxLength
     *  createUniqueNameWith({ baseName: "test-name-with-max-length-25", maxLength: 100, suffix: "-zz" })
     *  ```
     */
    static createUniqueNameWith(args: {
        baseName: string,
        maxLength: number,
        suffix?: string,
        hashLength?: number,
    }): string {
        const { baseName, maxLength, suffix = "", hashLength = 5 } = args

        if (baseName.length + suffix.length > maxLength) {
            const hash = require('crypto').createHash('md5').update(baseName).digest('hex').slice(0, hashLength)
            return `${baseName.slice(0, maxLength - suffix.length - hashLength)}${hash}${suffix}`
        } else {
            return `${baseName}${suffix}`
        }
    }
}