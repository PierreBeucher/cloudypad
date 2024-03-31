import logUpdate from 'log-update'
import chalk from 'chalk'
import * as os from 'os'
import * as fs from 'fs'
import upathpkg from 'upath'; // actual provided example
export const { joinSafe } = upathpkg;

//
// Global interface for logging
//

const tmpdir = os.tmpdir()
export const tmpLogFile = joinSafe(tmpdir, `${new Date().toISOString()}.log`)

function writeTmpLog(level: string, msg: string){
    fs.appendFileSync(tmpLogFile, `${level}: ${msg}`);   
}

export function debug(m: string){
    logUpdate.clear()
    console.debug(m)
}

export function info(m: string){
    logUpdate.clear()
    console.info(m)
}

export function warn(m: string){
    logUpdate.clear()
    console.warn(m)
}

export function error(m: string){
    logUpdate.clear()
    console.error(m)
}

const EPHEMERAL_LOG_MAX_LINES = 5

const ephemeralLogHistory : Array<string> = new Array<string>()

export function ephemeralInfo(m: string){
    writeTmpLog("info", m)

    // Split message into lines
    const splittedMsg = m.split("\n")

    // Add new lines at beginning of array
    ephemeralLogHistory.push(...splittedMsg)

    // Truncate if length exceed max
    if (ephemeralLogHistory.length > EPHEMERAL_LOG_MAX_LINES) {
        ephemeralLogHistory.splice(0, ephemeralLogHistory.length-EPHEMERAL_LOG_MAX_LINES)
    }
    
    logUpdate(chalk.gray(ephemeralLogHistory.join("\n")))
}

export function ephemeralClear(){
    logUpdate.clear()
}