/**
 * GCP specific validation helpers.
 */

/** Outcome of a disk resize validation. */
export type GcpDiskResizeOutcome = 'unchanged' | 'resize' | undefined

/**
 * Validate a requested new disk size against the current size.
 * @param current Current disk size (GB)
 * @param requested Requested disk size (GB)
 * @returns 'unchanged' if equal, 'resize' if larger, undefined if requested is undefined.
 * @throws Error if requested < current (shrink not supported)
 */
export function validateGcpDiskResize(current: number, requested: number | undefined): GcpDiskResizeOutcome {
  if (requested === undefined) return undefined
  if (requested < current) {
    throw new Error(`New disk size (${requested}GB) is smaller than current size (${current}GB). Shrinking is not supported on GCP.`)
  }
  return 'resize'
}
