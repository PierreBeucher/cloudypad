import * as crypto from 'crypto'

/**
 * Generate a cryptographically strong random password.
 *
 * Uses Node's CSPRNG (`crypto.randomBytes`) and encodes the result as
 * base64url (URL-safe charset `a-z A-Z 0-9 - _`, no padding).
 *
 * @param byteLength number of random bytes (entropy = byteLength * 8 bits). Default 24 = 192 bits.
 */
export function generateStrongPassword(byteLength: number = 24): string {
    return crypto.randomBytes(byteLength).toString('base64url')
}
