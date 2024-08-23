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
const DEFAULT_LOG_LEVEL = 4

let logVerbosity = process.env.CLOUDYPAD_LOG_LEVEL ? Number.parseInt(process.env.CLOUDYPAD_LOG_LEVEL) : DEFAULT_LOG_LEVEL

export type Logger = InternalLogger<ILogObj>

/**
 * Create a logger with the given name and arguments
 * @param name 
 * @param args 
 * @returns 
 */
export function getLogger(name: string, args = { minLevel: logVerbosity }): Logger {
    const logger = new InternalLogger<ILogObj>({ name: name, minLevel: args.minLevel})
    return logger
}

export function getLogVerbosity(){
    return logVerbosity
}

export function setLogVerbosity(v: number){
    logVerbosity=v
}