// export interface PortDefinition {
//     from: number,
//     to?: number,
//     protocol: "udp" | "tcp" | "all"
// }

// export const DEFAULT_PORTS : PortDefinition[] = [
//     { from: 22, to: 22, protocol: "tcp" },
// ]

// export const SUNSHINE_BASE_PORT = 47989

// /**
//  * Sunshine ports
//  * See ttps://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
//  */
// export const SUNSHINE_PORTS : PortDefinition[] = [
//     { from: SUNSHINE_BASE_PORT-5, to: SUNSHINE_BASE_PORT-5, protocol: "tcp" },
//     { from: SUNSHINE_BASE_PORT, to: SUNSHINE_BASE_PORT, protocol: "tcp" },
//     // { from: SUNSHINE_BASE_PORT+1, to: SUNSHINE_BASE_PORT+1, protocol: "tcp" }, # Web UI
//     { from: SUNSHINE_BASE_PORT+21, to: SUNSHINE_BASE_PORT+21, protocol: "tcp" },
//     { from: SUNSHINE_BASE_PORT+9, to: SUNSHINE_BASE_PORT+9, protocol: "udp" },
//     { from: SUNSHINE_BASE_PORT+10, to: SUNSHINE_BASE_PORT+10, protocol: "udp" },
//     { from: SUNSHINE_BASE_PORT+11, to: SUNSHINE_BASE_PORT+11, protocol: "udp" },
// ]

// /**
//  * Wolf ports
//  * See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
//  */
// export const WOLF_PORTS : PortDefinition[] = [
//     { from: 47984, protocol: "tcp" },  // HTTP
//     { from: 47989, protocol: "tcp" }, // HTTPS
//     { from: 48010, protocol: "tcp" }, // RTSP
//     { from: 47999, protocol: "udp" }, // Control
//     { from: 48100, to: 48110, protocol: "udp" }, // Video (up to 10 users)
//     { from: 48200, to: 48210, protocol: "udp" }, // Audio (up to 10 users)
// ]


