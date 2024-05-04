import { NodeSSH, SSHExecCommandResponse } from "node-ssh";
import { CloudyBoxLogObjI, componentLogger } from "../logging.js"
import { Logger } from "tslog";
import { getUserSSHPrivateKeyPath } from "./utils.js";

export interface SSHClientArgs {
    clientName: string
    host: string,
    port?: number,
    user: string,
    privateKeyPath?: string
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
    readonly logger: Logger<CloudyBoxLogObjI>
    currentPrivateKeyPath: string | undefined

    constructor(args: SSHClientArgs){
        this.args = args
        this.client = new NodeSSH()
        this.logger = componentLogger.getSubLogger({ name: `${this.args.clientName}` })
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
                this.logger.info(`Transferring ${itemPath}`)
                return true;
            },
            tick:(localPath, remotePath, error) => {
                if (error) {
                    this.logger.error(`Failed to copy ${localPath} to ${remotePath}: ${JSON.stringify(error)}`)
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
        const logger = this.logger
        const sshResp = await this.client.exec(command, exec.slice(1), {
            stream: "both",
            onStdout(chunk) {
                logger.info(`(stdout) ${logPrefix}: ${chunk.toString('utf8').trim()}`, )
            },
            onStderr(chunk) {
                logger.info(`(stderr) ${logPrefix}: ${chunk.toString('utf8').trim()}`)
            }
        })
    
        return sshResp
    }

    async waitForConnection(retries=12, delayMs=10000){
        for (let attempt = 1; attempt <= retries; attempt++){
            try {
                this.logger.info(`Trying SSH connect on ${this.args.host} (${attempt}/${retries})`)
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
        // Look for a private key if one hasn't been found already
        if (!this.currentPrivateKeyPath) {
            if (this.args.privateKeyPath) {
                this.currentPrivateKeyPath = this.args.privateKeyPath
            } else {
                this.logger.info("No private SSH key provided. Looking for one...")
                this.currentPrivateKeyPath = await getUserSSHPrivateKeyPath()
                this.logger.info(`Found private key: ${this.currentPrivateKeyPath}`)
            }
        }
        
        return this.client.connect({
            host: this.args.host,
            port: this.args.port,
            username: this.args.user,
            privateKeyPath: this.currentPrivateKeyPath
        });
    }
    
    async connect() {
        this.logger.info(`Connecting via SSH to ${this.args.host}...`)
    
        await this.doConnect()
    
    }

    dispose(){
        this.client.dispose()
    }
    
}

