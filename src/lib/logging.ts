import logUpdate from 'log-update'
import * as os from 'os'
import upathpkg from 'upath'; // actual provided example
export const { joinSafe } = upathpkg;
import { IMeta, Logger } from "tslog"
import chalk from 'chalk'
import * as fs from 'fs'

export interface CloudyBoxLogObjI {
    0: string,
    _meta: IMeta
}

//
// Internal logging framework
// 
// Logs are shown in different flavours:
// - "simple" by default in a user-friendly way: main actions are logged permanently and while "box" on N disappearing lines.
//   Suitable for simple usage. Full logs are saved to an external file
// - "advanced" logging show logs with full timestamp and details.

// Two loggers:
// - "main" logger for high-level action (mostly for main)
// - "box" logger (and children) for Box low-level actions
//
// This causses two logging framework to play with console stoud/stderr
// To avoid "conflicts" (buggy output, not preventhing things to work but not pretty and confusing)
// ephemeral logs are cleared everytime something is logged on main logger
//
// All logs are written to a temporary file to help debug.
//

const tmpdir = os.tmpdir()
export const tmpLogFile = joinSafe(tmpdir, `${new Date().toISOString()}.log`)

function initLoggers(logMode: "simple" | "advanced"){

    if (logMode == "simple") {
        const simpleMainLogger = new Logger<CloudyBoxLogObjI>({ 
            name: "main", 
            type: "hidden",
        })
    
        const delegatedSimpleMainLogger = new Logger<CloudyBoxLogObjI>({ 
            name: "main", 
            type: "pretty",
            prettyLogTemplate: ""
        })
   
        // Show simple log without details
        // Keep details in a file
        // Always clear output before logging
        simpleMainLogger.attachTransport((logObj) => {
            ephemeralClear()
            fs.appendFileSync(tmpLogFile, `${JSON.stringify(logObj)}\n`);   
            delegatedSimpleMainLogger.info(logObj[0])
        })
    
        // Box logger with ephemeral output
        // Write to tmp file 
        const simpleBoxLogger = new Logger<CloudyBoxLogObjI>({ name: "box", type: "hidden" });
    
        simpleBoxLogger.attachTransport(logObj => {
            fs.appendFileSync(tmpLogFile, `${JSON.stringify(logObj)}\n`);   
            newEphemeralInfo(logObj[0])
        })

        return {mainLogger: simpleMainLogger, boxLogger: simpleBoxLogger, detailedLogFile: tmpLogFile }

    } else if (logMode == "advanced") {

        const advancedMainLogger = new Logger<CloudyBoxLogObjI>({ 
            name: "main", 
            type: "pretty",
        })

        const advancedBoxLogger = new Logger<CloudyBoxLogObjI>({ 
            name: "box", 
            type: "pretty" 
        })

        return {mainLogger: advancedMainLogger, boxLogger: advancedBoxLogger}

    } else {
        throw new Error(`Unknown log mode: ${logMode}`)
    }
}

const loggers = initLoggers("advanced")
export const mainLogger = loggers.mainLogger
export const boxLogger = loggers.boxLogger

//
// Ephemeral logging
//

const EPHEMERAL_LOG_MAX_LINES = 5

const ephemeralLogHistory: Array<string> = new Array<string>()

// function writeTmpLog(level: string, msg: string){
//     fs.appendFileSync(tmpLogFile, `${level}: ${msg}`);   
// }

/**
 * Log message as ephemeral. Log history is kept in a FIFO so that calling this functions
 * shows the new log message and moves older message upward (if any).
 * A new message will "push" older message in the FIFO until they are dropped, 
 * allowing to show message such as:
 * 
 * first call:
 * 
 * # old_msg2
 * # old_msg1
 * # new_msg
 * 
 * Second call will cause older message to move upward
 * 
 * # old_msg1
 * # new_msg
 * # new_msg_bis
 * 
 */

export function newEphemeralInfo(m: string) {
    // Split message into lines
    const splittedMsg = m.split("\n")

    // Add new lines at beginning of array
    ephemeralLogHistory.push(...splittedMsg)

    // Truncate if length exceed max
    if (ephemeralLogHistory.length > EPHEMERAL_LOG_MAX_LINES) {
        ephemeralLogHistory.splice(0, ephemeralLogHistory.length - EPHEMERAL_LOG_MAX_LINES)
    }

    logUpdate(chalk.gray(ephemeralLogHistory.join("\n")))
}

export function ephemeralInfo(m: string) {

    // Split message into lines
    const splittedMsg = m.split("\n")

    // Add new lines at beginning of array
    ephemeralLogHistory.push(...splittedMsg)

    // Truncate if length exceed max
    if (ephemeralLogHistory.length > EPHEMERAL_LOG_MAX_LINES) {
        ephemeralLogHistory.splice(0, ephemeralLogHistory.length - EPHEMERAL_LOG_MAX_LINES)
    }

    logUpdate(chalk.gray(ephemeralLogHistory.join("\n")))
}

export function ephemeralClear() {
    logUpdate.clear()
}