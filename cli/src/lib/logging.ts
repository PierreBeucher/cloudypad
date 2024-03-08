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
    writeTmpLog("debug", m)
    console.debug(m)
}

export function info(m: string){
    writeTmpLog("info", m)
    console.info(m)
}


export function warn(m: string){
    writeTmpLog("warn", m)
    console.warn(m)
}

export function error(m: string){
    writeTmpLog("error", m)
    console.error(m)
}

export function ephemeralInfo(m: string){
    writeTmpLog("info", m)
    logUpdate(chalk.gray(m))
}

export function ephemeralClear(){
    logUpdate.clear()
}