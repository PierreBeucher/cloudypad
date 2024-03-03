import logUpdate from 'log-update'
import chalk from 'chalk'


//
// Utils function to log on stdout while actions are performed
//


export function gray(m: string){
    logUpdate(chalk.gray(m))
}

export function clear(){
    logUpdate.clear()
}