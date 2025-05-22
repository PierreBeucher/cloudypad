import { version } from '../../package.json'

export const CLOUDYPAD_PROVIDER_AWS = "aws"
export const CLOUDYPAD_PROVIDER_PAPERSPACE = "paperspace"
export const CLOUDYPAD_PROVIDER_AZURE = "azure"
export const CLOUDYPAD_PROVIDER_GCP = "gcp"
export const CLOUDYPAD_PROVIDER_LOCAL = "local"
export const CLOUDYPAD_PROVIDER_SCALEWAY = "scaleway"

export type CLOUDYPAD_PROVIDER = 
    typeof CLOUDYPAD_PROVIDER_AWS | 
    typeof CLOUDYPAD_PROVIDER_PAPERSPACE | 
    typeof CLOUDYPAD_PROVIDER_AZURE | 
    typeof CLOUDYPAD_PROVIDER_GCP | 
    typeof CLOUDYPAD_PROVIDER_LOCAL |
    typeof CLOUDYPAD_PROVIDER_SCALEWAY

export const CLOUDYPAD_PROVIDER_LIST = [ 
    CLOUDYPAD_PROVIDER_AWS, 
    CLOUDYPAD_PROVIDER_PAPERSPACE, 
    CLOUDYPAD_PROVIDER_AZURE, 
    CLOUDYPAD_PROVIDER_GCP, 
    CLOUDYPAD_PROVIDER_LOCAL,
    CLOUDYPAD_PROVIDER_SCALEWAY
] as const

export const CLOUDYPAD_CONFIGURATOR_ANSIBLE = "ansible"
export const CLOUDYPAD_CONFIGURATOR_LIST = [ CLOUDYPAD_CONFIGURATOR_ANSIBLE ] as const

/**
 * Most Cloud providers provide either static or dynamic IP.
 * Use this string to represent satic IP type.
 */
export const PUBLIC_IP_TYPE_STATIC = "static"

/**
 * Most Cloud providers provide either static or dynamic IP.
 * Use this string to represent dynamic IP type.
 */
export const PUBLIC_IP_TYPE_DYNAMIC = "dynamic"

/**
 * Most Cloud providers provide either static or dynamic IP.
 * Use this string to represent IP type.
 */
export type PUBLIC_IP_TYPE = typeof PUBLIC_IP_TYPE_DYNAMIC | typeof PUBLIC_IP_TYPE_STATIC

/**
 * Current Cloudy Pad version
 */
export const CLOUDYPAD_VERSION = version

/**
 * Default registry for Sunshine container image
 */
export const CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY = "ghcr.io/gabbelitov2/cloudypad"

/**
 * Simple port definition (number and protocol)
 * used to defined ports to expose on instance
 */
export interface SimplePortDefinition {
    port: number
    protocol: string
}

/**
 * Ports used by Wolf
 * See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
 */
export const CLOUDYPAD_WOLF_PORTS: SimplePortDefinition[] = [
    { port: 22, protocol: 'tcp' }, // SSH
    { port: 47984, protocol: 'tcp' }, // HTTPS
    { port: 47989, protocol: 'tcp' }, // HTTP
    { port: 47999, protocol: 'udp' }, // Control
    { port: 48010, protocol: 'tcp' }, // RTSP
    { port: 48100, protocol: 'udp' }, // Video (up to 10 users, you can open more ports if needed)
    { port: 48101, protocol: 'udp' },
    { port: 48102, protocol: 'udp' },
    { port: 48103, protocol: 'udp' },
    { port: 48104, protocol: 'udp' },
    { port: 48105, protocol: 'udp' },
    { port: 48106, protocol: 'udp' },
    { port: 48107, protocol: 'udp' },
    { port: 48108, protocol: 'udp' },
    { port: 48109, protocol: 'udp' },
    { port: 48110, protocol: 'udp' },
    { port: 48200, protocol: 'udp' }, // Audio (up to 10 users, you can open more ports if needed)
    { port: 48201, protocol: 'udp' },
    { port: 48202, protocol: 'udp' },
    { port: 48203, protocol: 'udp' },
    { port: 48204, protocol: 'udp' },
    { port: 48205, protocol: 'udp' },
    { port: 48206, protocol: 'udp' },
    { port: 48207, protocol: 'udp' },
    { port: 48208, protocol: 'udp' },
    { port: 48209, protocol: 'udp' },
    { port: 48210, protocol: 'udp' },
]

/**
 * Ports used by Sunshine
 * See https://github.com/moonlight-stream/moonlight-docs/wiki/Setup-Guide#manual-port-forwarding-advanced
 * Used to be documented clearly in doc but not anymore
 * See archive: https://web.archive.org/web/20241228223157/https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
 */
export const CLOUDYPAD_SUNSHINE_PORTS: SimplePortDefinition[] = [
    { port: 22, protocol: 'tcp' }, // SSH
    { port: 47984, protocol: 'tcp' }, // HTTPS
    { port: 47989, protocol: 'tcp' }, // HTTP
    { port: 47990, protocol: 'tcp' }, // Web
    { port: 48010, protocol: 'tcp' }, // RTSP

    { port: 47998, protocol: 'udp' }, // Video
    { port: 47999, protocol: 'udp' }, // Control
    { port: 48000, protocol: 'udp' }, // Audio
    { port: 48002, protocol: 'udp' }, // Mic (unused)
]