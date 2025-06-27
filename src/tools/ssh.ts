import { NodeSSH, SSHExecCommandResponse } from "node-ssh";
import * as sshpk from 'sshpk';
import * as fs from 'fs'
import { getLogger, Logger } from "../log/utils";
import { CommonProvisionInputV1, CommonProvisionOutputV1, InstanceStateV1 } from "../core/state/state";
import * as tmp from "tmp"
import { fromBase64 } from "./base64";

export interface SSHClientArgs {
    clientName: string
    host: string,
    port?: number,
    user: string,
    // For key-based authentication
    privateKeyPath?: string,
    // For password-based authentication
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
 * Build SSH client for a given instance state.
 * @param args - Instance arguments
 * @returns SSH client
 */
export function buildClientForInstance(args: {
    instanceName: string,
    provisionInput: CommonProvisionInputV1,
    provisionOutput: CommonProvisionOutputV1
}): SSHClient {
    const sshArgs = buildSshClientArgsForInstance(args)
    return new SSHClient(sshArgs)
}

/**
 * Build SSH client arguments for given instance. Args can be used to instantiate SSHClient.
 * @param args - Instance arguments
 * @returns SSH client arguments
 */
export function buildSshClientArgsForInstance(args: {
    instanceName: string, 
    provisionInput: CommonProvisionInputV1, 
    provisionOutput: CommonProvisionOutputV1
}): SSHClientArgs {
    // Check if we are using auth with password authentication
    if (args.provisionInput.auth && 
        typeof args.provisionInput.auth === 'object' && 
        'type' in args.provisionInput.auth && 
        args.provisionInput.auth.type === "password" &&
        'ssh' in args.provisionInput.auth &&
        typeof args.provisionInput.auth.ssh === 'object' &&
        args.provisionInput.auth.ssh !== null &&
        'user' in args.provisionInput.auth.ssh &&
        'password' in args.provisionInput.auth.ssh &&
        typeof args.provisionInput.auth.ssh.user === 'string' &&
        typeof args.provisionInput.auth.ssh.password === 'string') {
        // Password authentication takes precedence
        return {
            clientName: args.instanceName,
            host: args.provisionOutput.host,
            port: 22,
            user: args.provisionInput.auth.ssh.user,
            password: args.provisionInput.auth.ssh.password
        }
    } else if (args.provisionInput.ssh) {
        // Check if we have valid SSH key info
        const hasValidKeyPath = args.provisionInput.ssh.privateKeyPath && 
                                args.provisionInput.ssh.privateKeyPath.length > 0;
        
        const hasValidKeyContent = args.provisionInput.ssh.privateKeyContentBase64 && 
                                   args.provisionInput.ssh.privateKeyContentBase64.length > 0;
        
        if (hasValidKeyPath || hasValidKeyContent) {
            // Standard authentication with SSH key
            const sshKeyPath = new SshKeyLoader().getSshPrivateKeyPath(args.provisionInput.ssh);
            return {
                clientName: args.instanceName,
                host: args.provisionOutput.host,
                port: 22,
                user: args.provisionInput.ssh.user,
                privateKeyPath: sshKeyPath
            }
        } else {
            throw new Error("No valid SSH key found. Either privateKeyPath or privateKeyContentBase64 must be provided for SSH key authentication");
        }
    } else {
        throw new Error("No valid authentication method found in provision input. Ensure either auth.ssh (password auth) or ssh (key auth) is properly configured");
    }
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
            validate: (itemPath: string) => {
                this.logger.trace(`Transferring ${itemPath}`)
                return true;
            },
            tick:(localPath: string, remotePath: string, error: any) => {
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
            onStdout: (chunk: Buffer) => {
                this.logger.trace(`(stdout) ${logPrefix}: ${chunk.toString('utf8').trim()}`)
            },
            onStderr: (chunk: Buffer) => {
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

        const connectConfig: any = {
            host: this.args.host,
            port: this.args.port,
            username: this.args.user,
        };

        // Use either password or key-based authentication
        if (this.args.password) {
            connectConfig.password = this.args.password;
        } else if (this.args.privateKeyPath) {
            connectConfig.privateKeyPath = this.args.privateKeyPath;
        } else {
            throw new Error("No authentication method available. Either password or privateKeyPath must be specified.");
        }

        return this.client.connect(connectConfig);
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

/**
 * Load SSH keys from instance inputs
 */
export class SshKeyLoader {

    /**
     * Get SSH private key path from instance inputs. Return key path from privateKeyPath or 
     * generate a temporary secure key file from privateKeyContentBase64.
     * @param ssh - SSH access configuration
     * @returns SSH private key path
     */
    getSshPrivateKeyPath(ssh: CommonProvisionInputV1["ssh"]){
        if (!ssh) {
            throw new Error("SSH configuration is undefined");
        }
        
        // Check for valid privateKeyPath
        if(ssh.privateKeyPath && ssh.privateKeyPath.length > 0){
            return ssh.privateKeyPath
        } 
        // Check for valid privateKeyContentBase64
        else if (ssh.privateKeyContentBase64 && ssh.privateKeyContentBase64.length > 0){
            const tempKeyFile = tmp.fileSync({ mode: 0o600})
            fs.writeFileSync(tempKeyFile.name, fromBase64(ssh.privateKeyContentBase64))
            return tempKeyFile.name
        } else {
            throw new Error("No valid SSH private key found, both privateKeyPath and privateKeyContentBase64 are empty or missing")
        }
    }

    /**
     * Load SSH private key content from instance inputs. Return either content from file or decoded base64 content.
     * @param ssh - SSH access configuration
     * @returns SSH private key content
     */
    loadSshPrivateKeyContent(ssh: CommonProvisionInputV1["ssh"]){
        if (!ssh) {
            throw new Error("SSH configuration is undefined");
        }
        
        if(ssh.privateKeyPath){
            return fs.readFileSync(ssh.privateKeyPath, 'utf8')
        } else if (ssh.privateKeyContentBase64){
            return fromBase64(ssh.privateKeyContentBase64)
        } else {
            throw new Error("No SSH private key found")
        }
    }

    /**
     * Load SSH public key content from instance inputs. Return either content from file or generate public key from private.
     * @param ssh - SSH access configuration
     * @returns SSH public key content
     */
    loadSshPublicKeyContent(ssh: CommonProvisionInputV1["ssh"]) {
        return this._loadSshPublicKeyContent(ssh)
    }

    _loadSshPublicKeyContent(ssh: CommonProvisionInputV1["ssh"]) {
        if (!ssh) {
            throw new Error("SSH configuration is undefined");
        }
        
        // Key ID can be anything, only used for fingerprint which we don't need
        const privateKey = this.loadSshPrivateKeyContent(ssh)
        const key = sshpk.parsePrivateKey(privateKey, 'auto', { filename: "dummy_key" })

        return key.toPublic().toString('ssh')
    }
}

export function generatePrivateSshKey(): string {
    const newKey = sshpk.generatePrivateKey("ed25519")
    return newKey.toString("ssh-private")
}
