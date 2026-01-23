import { LINODE_LABEL_MAX_LENGTH } from "./main"
import { ShaUtils } from "../../../tools/sha-utils"

/**
 * Create a valid Linode label (no more than LINODE_LABEL_MAX_LENGTH length)
 * @param name desired label name, trimmed with hash if too long
 * @param suffix desired suffix, always appear
 */ 
export function linodeLabel(name: string, suffix?: string){
return ShaUtils.createUniqueNameWith({ 
    baseName: name, 
    maxLength: LINODE_LABEL_MAX_LENGTH, 
    suffix: suffix
})
}