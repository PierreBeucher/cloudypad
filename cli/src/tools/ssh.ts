import { NodeSSH, SSHExecCommandResponse } from "node-ssh";
import sshpk from 'sshpk';
export const { parseKey, parsePrivateKey } = sshpk;
import * as fs from 'fs'

export interface SSHClientArgs {
    clientName: string
    host: string,
    port?: number,
    user: string,
    privateKeyPath: string
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

export interface SSHCommandOpts {
    logPrefix?: string, 
    ignoreNonZeroExitCode?: boolean
}

/**
 * Simple SSH client implementation
 */
export class SSHClient {
    
    readonly client: NodeSSH
    readonly args: SSHClientArgs

    constructor(args: SSHClientArgs){
        this.args = args
        this.client = new NodeSSH()
    }

    async command(cmd: string[], args?: SSHCommandOpts) : Promise<SSHExecCommandResponse>{
        if (cmd.length < 0){
            throw new Error("Command array length must be >0")
        }
    
        const result = await this.sshExec(cmd, args?.logPrefix || cmd[0])
        if (result.code != 0 && !args?.ignoreNonZeroExitCode){
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
                console.info(`Transferring ${itemPath}`)
                return true;
            },
            tick:(localPath, remotePath, error) => {
                if (error) {
                    console.error(`Failed to copy ${localPath} to ${remotePath}: ${JSON.stringify(error)}`)
                    fail.push(localPath)
                } else {
                    ok.push(localPath)
                }

            }
        })
    
        if (!putStatus) {
            throw new SSHFileTransferError(`Some file(s) failed to transfer: ${JSON.stringify(fail)}`, ok, fail)
        }
    }
    
    private async sshExec(exec: string[], logPrefix: string) : Promise<SSHExecCommandResponse>{
        if (!exec.length){
            throw new Error("No command provided.")
        }
        const command = exec[0]
        const sshResp = await this.client.exec(command, exec.slice(1), {
            stream: "both",
            onStdout(chunk) {
                // console.debug(`(stdout) ${logPrefix}: ${chunk.toString('utf8').trim()}`, )
            },
            onStderr(chunk) {
                // console.debug(`(stderr) ${logPrefix}: ${chunk.toString('utf8').trim()}`)
            }
        })
    
        return sshResp
    }

    async waitForConnection(retries=12, delayMs=10000){
        for (let attempt = 1; attempt <= retries; attempt++){
            try {
                console.info(`Trying SSH connect on ${this.args.host} (${attempt}/${retries})`)
                await this.doConnect()
                return
            } catch (e){
                if (attempt == retries){
                    throw e
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        
    }
    private async doConnect(){
        return this.client.connect({
            host: this.args.host,
            port: this.args.port,
            username: this.args.user,
            privateKeyPath: this.args.privateKeyPath
        });
    }
    
    async connect() {
        console.info(`Connecting via SSH to ${this.args.host}...`)
        await this.doConnect()
    }

    dispose(){
        try {
            this.client.dispose()
        } catch (e) {
            console.error(`Disposing client ${this.args.clientName}: ${e}`, e)
        }
    }
    
}

export async function parseSshPrivateKeyFileToPublic(keyPath: string){
    const kData = fs.readFileSync(keyPath, { encoding: 'utf8' });
    return parseSshPrivateKeyToPublic(kData)
}

export async function parseSshPrivateKeyToPublic(keyData: string){
    const privKey = parseKey(keyData, "ssh-private")
    return privKey.toString("ssh")
}