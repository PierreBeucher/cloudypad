import { LINODE_LABEL_MAX_LENGTH } from "./main"
import { ShaUtils } from "../../../tools/sha-utils"

/**
 * Slugify a string to contain only lowercase letters, numbers, underscores, and dashes.
 * Replaces invalid characters with dashes and removes consecutive/leading/trailing dashes.
 */
function slugify(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')  // Replace invalid chars with dash
        .replace(/-+/g, '-')            // Replace consecutive dashes with single dash
        .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
}

/**
 * Create a valid Linode label: no more than LINODE_LABEL_MAX_LENGTH length,
 * only using ascii letters, numbers, underscores, and dashes
 * 
 * @param name desired label name, trimmed with hash if too long
 * @param suffix desired suffix, always appear
 */ 
export function linodeLabel(name: string, suffix?: string){
    const uniqueName = ShaUtils.createUniqueNameWith({ 
        baseName: name, 
        maxLength: LINODE_LABEL_MAX_LENGTH, 
        suffix: suffix
    })
    return slugify(uniqueName)
}