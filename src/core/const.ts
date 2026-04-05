import { version } from '../../package.json'

export const CLOUDYPAD_PROVIDER_AWS = "aws"
export const CLOUDYPAD_PROVIDER_PAPERSPACE = "paperspace"
export const CLOUDYPAD_PROVIDER_AZURE = "azure"
export const CLOUDYPAD_PROVIDER_GCP = "gcp"
export const CLOUDYPAD_PROVIDER_DUMMY = "dummy"
export const CLOUDYPAD_PROVIDER_SCALEWAY = "scaleway"
export const CLOUDYPAD_PROVIDER_SSH = "ssh"
export const CLOUDYPAD_PROVIDER_LINODE = "linode"

export type CLOUDYPAD_PROVIDER = 
    typeof CLOUDYPAD_PROVIDER_AWS | 
    typeof CLOUDYPAD_PROVIDER_PAPERSPACE | 
    typeof CLOUDYPAD_PROVIDER_AZURE | 
    typeof CLOUDYPAD_PROVIDER_GCP | 
    typeof CLOUDYPAD_PROVIDER_DUMMY |
    typeof CLOUDYPAD_PROVIDER_SCALEWAY |
    typeof CLOUDYPAD_PROVIDER_SSH |
    typeof CLOUDYPAD_PROVIDER_LINODE

export const CLOUDYPAD_PROVIDER_LIST = [ 
    CLOUDYPAD_PROVIDER_AWS, 
    CLOUDYPAD_PROVIDER_PAPERSPACE, 
    CLOUDYPAD_PROVIDER_AZURE, 
    CLOUDYPAD_PROVIDER_GCP, 
    CLOUDYPAD_PROVIDER_DUMMY,
    CLOUDYPAD_PROVIDER_SCALEWAY,
    CLOUDYPAD_PROVIDER_SSH,
    CLOUDYPAD_PROVIDER_LINODE
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
export const CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY = "ghcr.io/pierrebeucher/cloudypad"

/**
 * Simple port definition (number and protocol)
 * used to defined ports to expose on instance
 */
export interface SimplePortDefinition {
    port: number
    protocol: string
    description?: string
}

/**
 * Ports used by Wolf
 * See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
 */
export const CLOUDYPAD_WOLF_PORTS: SimplePortDefinition[] = [
    { port: 22, protocol: 'tcp', description: 'SSH' },
    { port: 47984, protocol: 'tcp', description: 'Wolf HTTPS control' },
    { port: 47989, protocol: 'tcp', description: 'Wolf HTTP control' },
    { port: 47999, protocol: 'udp', description: 'Wolf Moonlight control channel' },
    { port: 48010, protocol: 'tcp', description: 'Wolf RTSP stream setup' },
    { port: 48100, protocol: 'udp', description: 'Wolf video stream (user 1)' },
    { port: 48101, protocol: 'udp', description: 'Wolf video stream (user 2)' },
    { port: 48102, protocol: 'udp', description: 'Wolf video stream (user 3)' },
    { port: 48103, protocol: 'udp', description: 'Wolf video stream (user 4)' },
    { port: 48104, protocol: 'udp', description: 'Wolf video stream (user 5)' },
    { port: 48105, protocol: 'udp', description: 'Wolf video stream (user 6)' },
    { port: 48106, protocol: 'udp', description: 'Wolf video stream (user 7)' },
    { port: 48107, protocol: 'udp', description: 'Wolf video stream (user 8)' },
    { port: 48108, protocol: 'udp', description: 'Wolf video stream (user 9)' },
    { port: 48109, protocol: 'udp', description: 'Wolf video stream (user 10)' },
    { port: 48110, protocol: 'udp', description: 'Wolf video stream (user 11)' },
    { port: 48200, protocol: 'udp', description: 'Wolf audio stream (user 1)' },
    { port: 48201, protocol: 'udp', description: 'Wolf audio stream (user 2)' },
    { port: 48202, protocol: 'udp', description: 'Wolf audio stream (user 3)' },
    { port: 48203, protocol: 'udp', description: 'Wolf audio stream (user 4)' },
    { port: 48204, protocol: 'udp', description: 'Wolf audio stream (user 5)' },
    { port: 48205, protocol: 'udp', description: 'Wolf audio stream (user 6)' },
    { port: 48206, protocol: 'udp', description: 'Wolf audio stream (user 7)' },
    { port: 48207, protocol: 'udp', description: 'Wolf audio stream (user 8)' },
    { port: 48208, protocol: 'udp', description: 'Wolf audio stream (user 9)' },
    { port: 48209, protocol: 'udp', description: 'Wolf audio stream (user 10)' },
    { port: 48210, protocol: 'udp', description: 'Wolf audio stream (user 11)' },
]

/**
 * Ports used by Sunshine
 * See https://github.com/moonlight-stream/moonlight-docs/wiki/Setup-Guide#manual-port-forwarding-advanced
 * Used to be documented clearly in doc but not anymore
 * See archive: https://web.archive.org/web/20241228223157/https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
 */
export const CLOUDYPAD_SUNSHINE_PORTS: SimplePortDefinition[] = [
    { port: 22, protocol: 'tcp', description: 'SSH' },
    { port: 47984, protocol: 'tcp', description: 'Sunshine HTTPS control' },
    { port: 47989, protocol: 'tcp', description: 'Sunshine HTTP control' },
    { port: 47990, protocol: 'tcp', description: 'Sunshine web UI' },
    { port: 48010, protocol: 'tcp', description: 'Sunshine RTSP stream setup' },
    { port: 47998, protocol: 'udp', description: 'Sunshine video stream' },
    { port: 47999, protocol: 'udp', description: 'Sunshine Moonlight control channel' },
    { port: 48000, protocol: 'udp', description: 'Sunshine audio stream' },
    { port: 48002, protocol: 'udp', description: 'Sunshine microphone input (client to server)' },
]

/**
 * Data disk state values for runtime provisioning control
 * Live: data disk should exist, created from existing snapshot if possible.
 */
export const DATA_DISK_STATE_LIVE = "live" as const

/**
 * Data disk state values for runtime provisioning control
 * Snapshot: a data disk snapshot should be created, the original data disk should be deleted after snapshot created.
 */
export const DATA_DISK_STATE_SNAPSHOT = "snapshot" as const

/**
 * Instance server state values for runtime provisioning control
 * Present: instance server should exist
 */
export const INSTANCE_SERVER_STATE_PRESENT = "present" as const

export type DATA_DISK_STATE = typeof DATA_DISK_STATE_LIVE | typeof DATA_DISK_STATE_SNAPSHOT

/**
 * Instance server state values for runtime provisioning control
 * Absent: instance server should be deleted
 */
export const INSTANCE_SERVER_STATE_ABSENT = "absent" as const

export type INSTANCE_SERVER_STATE = typeof INSTANCE_SERVER_STATE_PRESENT | typeof INSTANCE_SERVER_STATE_ABSENT