import { NodeSSH, SSHExecCommandResponse } from "node-ssh";
import * as logging from "../logging.js"

export interface SSHClientArgs {
    host: string,
    port?: number,
    user: string,
    sshKeyPath?: string
}

export class SSHExecError extends Error{
    e: SSHExecCommandResponse
    
    constructor(m: string, e: SSHExecCommandResponse){
        super(m)
        this.e = e
    }

}

export class SSHFileTransferError extends Error{
    ok: string[]
    fail: string[]
    
    constructor(m: string, ok: string[], fail: string[]){
        super(m)
        this.ok = ok
        this.fail = fail
    }

}

/**
 * Simple SSH client implementation
 */
export class SSHClient {
    
    client: NodeSSH
    args: SSHClientArgs

    constructor(args: SSHClientArgs){
        this.args = args
        this.client = new NodeSSH()
    }

    async command(cmd: string[], logPrefix?: string) : Promise<SSHExecCommandResponse>{
        if (cmd.length < 0){
            throw new Error("Command array length must be >0")
        }
    
        const result = await this.#sshExec(cmd, logPrefix || cmd[0])
        if (result.code != 0){
            throw new SSHExecError(`Error running command: '${JSON.stringify(cmd)}'`, result)
        }

        return result
    }
    
    async putFile(src: string, dest: string){
        await this.client.putFile(src, dest)
    }

    async putDirectory(src: string, dest: string){
        const ok: string[] = []
        const fail: string[] = []
        const putStatus = await this.client.putDirectory(src, dest, {
            transferOptions: {
    
            },
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                logging.ephemeralInfo(`Transferring ${itemPath}`)
                return true;
            },
            tick:(localPath, remotePath, error) => {
                if (error) {
                    console.error(`Failed to copy ${localPath} to ${remotePath}: ${error}`)
                    fail.push(localPath)
                } else {
                    ok.push(localPath)
                }

            }
        })
        logging.ephemeralClear()
    
        if (!putStatus) {
            throw new SSHFileTransferError(`Some file(s) failed to transfer: ${JSON.stringify(fail)}`, ok, fail)
        }
    }
    
    async #sshExec(exec: string[], logPrefix: string, stderrLogPefix?: string) : Promise<SSHExecCommandResponse>{
        if (!exec.length){
            throw new Error("No command provided.")
        }
        const command = exec[0]
        const sshResp = await this.client.exec(command, exec.slice(1), {
            stream: "both",
            onStdout(chunk) {
                logging.ephemeralInfo(`${logPrefix}: ${chunk.toString('utf8').trim()}`, )
            },
            onStderr(chunk) {
                logging.ephemeralInfo(`${stderrLogPefix || logPrefix}: ${chunk.toString('utf8').trim()}`)
            }
        })
        logging.ephemeralClear()
    
        return sshResp
    }
    
    async connect() {
        logging.ephemeralInfo(`Connecting via SSH to ${this.args.host}...`)
    
        await this.client.connect({
            host: this.args.host,
            port: this.args.port,
            username: this.args.user,
            privateKeyPath: this.args.sshKeyPath
        });
    
        logging.ephemeralClear()
    }

    dispose(){
        this.client.dispose()
    }
    
}

