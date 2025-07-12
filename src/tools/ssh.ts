import { NodeSSH, SSHExecCommandResponse } from "node-ssh";
import * as sshpk from 'sshpk';
import * as fs from 'fs'
import { getLogger, Logger } from "../log/utils";
import { CommonProvisionInputV1, CommonProvisionOutputV1, InstanceStateV1 } from "../core/state/state";
import * as tmp from "tmp"
import { fromBase64 } from "./base64";

/**
 * SSH client arguments. Either privateKeyPath or password must be provided, not both.
 */
export interface SSHClientArgs {
    clientName: string
    host: string,
    port?: number,
    user: string,
    privateKeyPath?: string,
    password?: string
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
    private readonly logger: Logger

    constructor(args: SSHClientArgs){
        this.args = args
        this.client = new NodeSSH()
        this.logger = getLogger(args.clientName)
    }

    /**
     * Check if SSH is ready by trying to connect to the server
     * @returns true if SSH is ready, false otherwise
     */
    async isReady(){

        try {
            await this.connect()
            return true
        } catch (e) {
            this.logger.debug(`Expected error checking for SSH connection: ${e}`)
            return false
        }
    }

    async command(cmd: string[], args?: SSHCommandOpts) : Promise<SSHExecCommandResponse>{
        if (cmd.length < 0){
            throw new Error("Command array length must be >0")
        }

        this.logger.debug(`Running SSH command: ${JSON.stringify(cmd)}`)

        const result = await this.sshExec(cmd, args?.logPrefix || cmd[0])

        this.logger.debug(`SSH command response: ${JSON.stringify(result)}`)

        if (result.code != 0 && !args?.ignoreNonZeroExitCode){
            throw new Error(`Error running command: '${JSON.stringify(cmd)}', SSH response: ${JSON.stringify(result)}`)
        }

        return result
    }
    
    async putFile(src: string, dest: string){
        this.logger.debug(`Transferring file from ${src} to ${dest}`)

        await this.client.putFile(src, dest)
        
        this.logger.debug(`File transferred from ${src} to ${dest}`)
    }

    async putDirectory(src: string, dest: string){
        const ok: string[] = []
        const fail: string[] = []
        
        this.logger.debug(`Transferring directory from ${src} to ${dest}`)
        
        const putStatus = await this.client.putDirectory(src, dest, {
            transferOptions: {
    
            },
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                this.logger.trace(`Transferring ${itemPath}`)
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
        this.logger.debug(`Directory transferred from ${src} to ${dest}`)
    }
    
    private async sshExec(exec: string[], logPrefix: string) : Promise<SSHExecCommandResponse>{
        if (!exec.length){
            throw new Error("No command provided.")
        }
        const command = exec[0]
        const sshResp = await this.client.exec(command, exec.slice(1), {
            stream: "both",
            onStdout: (chunk) => {
                this.logger.trace(`(stdout) ${logPrefix}: ${chunk.toString('utf8').trim()}`)
            },
            onStderr: (chunk) => {
                this.logger.trace(`(stderr) ${logPrefix}: ${chunk.toString('utf8').trim()}`)
            }
        })
    
        return sshResp
    }

    async waitForConnection(retries=12, delayMs=10000){
        for (let attempt = 1; attempt <= retries; attempt++){
            try {
                this.logger.debug(`Trying SSH connect on ${this.args.host} (${attempt}/${retries})`)
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
        // avoid multiple connections otherwise ssh client leave multiple connections open
        // which make program hangs
        if(this.client.isConnected()) return this.client

        this.logger.debug(`Connecting to '${this.args.user}@${this.args.host}' port '${this.args.port}'` + 
            `(ssh key: '${this.args.privateKeyPath}', password: ${this.args.password ? 'yes' : 'no'})`)

        return this.client.connect({
            host: this.args.host,
            port: this.args.port,
            username: this.args.user,
            privateKeyPath: this.args.privateKeyPath,
            password: this.args.password
        });
    }
    
    async connect() {
        this.logger.debug(`Connecting via SSH to ${this.args.host}...`)
        await this.doConnect()
    }

    dispose(){
        try {
            this.client.dispose()
        } catch (e) {
            this.logger.error(`Disposing client ${this.args.clientName}: ${e}`, e)
            // Voluntarily do not rethrow error as cleanup error is not critical
        }
    }
    
}

export interface SshAuth {
    privateKeyPath?: string,
    password?: string
}

/**
 * Load SSH keys from instance inputs
 */
export class SshKeyLoader {

    /**
     * Get an SSH private key or password from given ssh args. Throws an error if the given args
     * cannot produce either an ssh key path or a password.
     * If both SSH key path and base64 content are provided, SSH key path is preferred.
     * @param ssh - SSH access configuration
     * @returns SSH private key path or password. Guaranteed to have at least one of key or password. An exception is thrown otherwise.
     */
    getSshAuth(ssh: CommonProvisionInputV1["ssh"]): SshAuth {
        const result: SshAuth = {}
        
        // set private key path if given, try to decode base64 content otherwise
        if(ssh.privateKeyPath){
            result.privateKeyPath = ssh.privateKeyPath
        } else if (ssh.privateKeyContentBase64){
            const tempKeyFile = tmp.fileSync({ mode: 0o600})
            fs.writeFileSync(tempKeyFile.name, fromBase64(ssh.privateKeyContentBase64))
            result.privateKeyPath = tempKeyFile.name
        }

        // set password if given
        if (ssh.passwordBase64){
            result.password = Buffer.from(ssh.passwordBase64, 'base64').toString('utf-8')
        }

        if (!result.privateKeyPath && !result.password){
            throw new Error("No SSH private key or password provided.")
        }

        return result
    }

    /**
     * Load SSH private key content from instance inputs
     * @param ssh - SSH access configuration
     * @returns SSH private key content
     */
    loadSshPrivateKeyContent(ssh: CommonProvisionInputV1["ssh"]){
        if(ssh.privateKeyPath){
            return fs.readFileSync(ssh.privateKeyPath, { encoding: 'utf8' })
        } else if (ssh.privateKeyContentBase64){
            return fromBase64(ssh.privateKeyContentBase64)
        } else {
            throw new Error("No SSH private key provided, neither privateKeyPath nor privateKeyContentBase64 is set.")
        }
    }

    /**
     * Load SSH public key content from instance inputs
     * @param ssh - SSH access configuration
     * @returns SSH public key content
     */
    loadSshPublicKeyContent(ssh: CommonProvisionInputV1["ssh"]) {
        return this._loadSshPublicKeyContent(ssh)
    }

    // real function which won't be mocked
    _loadSshPublicKeyContent(ssh: CommonProvisionInputV1["ssh"]) {
        const privateKeyContent = this.loadSshPrivateKeyContent(ssh)
        return sshpk.parseKey(privateKeyContent, "ssh-private").toString("ssh")
    }
}

/**
 * Generate a new SSH private key using ed25519 algorithm
 * @returns SSH private key content as string
 */
export function generatePrivateSshKey(): string {
    const newKey = sshpk.generatePrivateKey("ed25519")
    return newKey.toString("ssh-private")
}
