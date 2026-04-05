import * as https from 'https'

/**
 * Fetch the current external IP address for the given address family.
 *
 * Returns undefined if the request fails or times out (e.g. no IPv6 connectivity).
 * Uses the AWS checkip endpoint which is reliable and provider-agnostic.
 */
export function fetchCurrentIp(family: 4 | 6, timeoutMs = 5000): Promise<string | undefined> {
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'checkip.global.api.aws',
            path: '/',
            method: 'GET',
            family,
            timeout: timeoutMs,
        }, (res) => {
            let data = ''
            res.on('data', (chunk: string) => { data += chunk })
            res.on('end', () => resolve(data.trim()))
        })
        req.on('timeout', () => { req.destroy(); resolve(undefined) })
        req.on('error', () => resolve(undefined))
        req.end()
    })
}

/**
 * Fetch the current external IPv4 and IPv6 addresses and return them as CIDR ranges.
 * Throws if the IPv4 address cannot be detected.
 * IPv6 is best-effort; an empty array is returned if unavailable.
 */
export async function fetchCurrentIpCidrs(): Promise<{ ipv4: string[], ipv6: string[] }> {
    const [ipv4, ipv6] = await Promise.all([fetchCurrentIp(4), fetchCurrentIp(6)])
    if (!ipv4) {
        throw new Error('Could not detect current IPv4 address. Check your internet connection.')
    }
    return {
        ipv4: [`${ipv4}/32`],
        ipv6: ipv6 ? [`${ipv6}/128`] : [],
    }
}
