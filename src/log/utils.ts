import { Logger as InternalLogger } from "tslog";

//
// Logging utility used globally
//

/* eslint-disable @typescript-eslint/no-empty-object-type */
interface ILogObj {

}

/**
 * Default log level. See https://tslog.js.org/#/?id=default-log-level
 */
let DEFAULT_LOG_LEVEL = 4

export type Logger = InternalLogger<ILogObj>

/**
 * Create a logger with the given name and arguments
 * @param name 
 * @param args 
 * @returns 
 */
export function getLogger(name: string, args = { minLevel: DEFAULT_LOG_LEVEL }): Logger {
    const logger = new InternalLogger<ILogObj>({ name: name, minLevel: args.minLevel})
    return logger
}

export function setDefaultVerbosity(v: number){
    DEFAULT_LOG_LEVEL=v
}