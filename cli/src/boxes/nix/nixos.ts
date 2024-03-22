import lodash from 'lodash';
const { merge } = lodash;
import { BoxMetadata } from "../../lib/core.js";
import { NixOSProvisioner } from "../../lib/provision/nixos.js";
import { SSHClient, SSHCommandOpts } from "../../lib/provision/ssh.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { BOX_SCHEMA_EC2_INSTANCE_SPEC, EC2InstanceBoxManager, EC2InstanceBoxManagerArgs } from "../aws/ec2-instance.js";
import { BOX_SCHEMA_BASE } from "../common/base.js";
import { CloudVMBoxManager, CloudVMBoxManagerOutputs as CloudVMBoxOutputs, SSHConfig, SUBSCHEMA_SSH_DEFINITION } from "../common/cloud-virtual-machine.js";
import { z } from "zod";
import * as logging from "../../lib/logging.js"

export const KIND_LINUX_NIXOS = "linux.NixOS"

export const SUBSCHEMA_NIXOS_CONFIG = z.object({
    nixosConfigName: z.string(),
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string())
})

export const BOX_SPEC_NIXOS = z.object({
    nixos: SUBSCHEMA_NIXOS_CONFIG,
    ssh: SUBSCHEMA_SSH_DEFINITION,
    cloud: z.object({
        aws: BOX_SCHEMA_EC2_INSTANCE_SPEC.partial()
    })
})    

export const BOX_SCHEMA_NIXOS = BOX_SCHEMA_BASE.extend({
    spec: BOX_SPEC_NIXOS
})

export type NixOSBoxSpec = z.infer<typeof BOX_SPEC_NIXOS>
export type NixOSBoxSchema = z.infer<typeof BOX_SCHEMA_NIXOS>
export type NixOSConfig = z.infer<typeof SUBSCHEMA_NIXOS_CONFIG>

export interface NixOSBoxManagerArgs {
    cloud: CloudVMBoxManager
    nixos: NixOSConfig
    ssh: SSHConfig
}

export class NixOSBoxManager implements CloudVMBoxManager {

    readonly meta: BoxMetadata
    readonly args: NixOSBoxManagerArgs

    constructor(name: string, args: NixOSBoxManagerArgs, kind = KIND_LINUX_NIXOS) {
        this.meta = new BoxMetadata({ name: name, kind: kind})
        this.args = args
    }

    public async deploy() {
        const o = await this.args.cloud.deploy()
        await this.provision()
        return o
    }

    public async provision() {
        const o = await this.get()
        logging.info("   Provisioning NixOS instance...")

        await this.doWaitForSsh(o)

        const nixosPrv = this.buildNixosProvisioner(o)
        await nixosPrv.ensureNixChannel(this.args.nixos.nixosChannel, this.args.nixos.homeManagerRelease)
        await nixosPrv.ensureNixosConfig(this.args.nixos.nixosConfigName)
        logging.info("   NixOS instance provisioned !")

        return o
    }

    public async destroy(): Promise<void> {
        return this.args.cloud.destroy()
    }

    public async preview(): Promise<string> {
        return this.args.cloud.preview()
    }

    public async get(): Promise<CloudVMBoxOutputs> {
        return this.args.cloud.get()
    }

    public async stop() {
        return this.args.cloud.stop()
    }

    public async start() {
        return this.args.cloud.start()
    }

    public async restart() {
        return this.args.cloud.restart()
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const o = await this.get()
        return this.doRunSshCommand(o, cmd, opts)
    }

    public async waitForSsh(){
        const o = await this.get()
        this.doWaitForSsh(o)
    }

    public async getMetadata(): Promise<BoxMetadata> {
        return this.meta
    }

    private async doWaitForSsh(o: CloudVMBoxOutputs){
        const ssh = this.buildSshClient(o)
        try {
            return await ssh.waitForConnection()
        } finally {
            ssh.dispose()
        }
    }

    private async doRunSshCommand(o: CloudVMBoxOutputs, cmd: string[], opts?: SSHCommandOpts){
        const ssh = this.buildSshClient(o)        
        try {
            await ssh.connect()
            return await ssh.command(cmd, opts)
        } finally {
            ssh.dispose();
        }
    }

    private buildNixosProvisioner(o: CloudVMBoxOutputs){
        return new NixOSProvisioner({
            host: o.ipAddress,
            port: this.args.ssh.port,
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }

    private buildSshClient(o: CloudVMBoxOutputs){
        return new SSHClient({
            host: o.ipAddress,
            user: this.args.ssh.user || "root",
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }
}

export async function parseLinuxNixOSBoxSpec(rawConfig: unknown) : Promise<NixOSBoxManager> {
    const config = await BOX_SCHEMA_NIXOS.parseAsync(rawConfig)

    const defaultAwsConfig: EC2InstanceBoxManagerArgs = {
        config: {
            region: "eu-central-1" // TODO from user environment?
        }, 
        instance: {
            ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
            publicKey: await parseSshPrivateKeyToPublic(config.spec.ssh.privateKeyPath),
            type: "t3.small", // TODO not as default ? May be hard for update
            rootVolume: {
                sizeGb: 16 // NixOS needs generous amount of disk by default
            }
        },
        ingressPorts: [{
            from: 22
        }]
    }
    const finalAwsConfig = merge(defaultAwsConfig, config.spec.cloud.aws)

    const awsBoxManager = new EC2InstanceBoxManager(`nixos-${config.name}`, finalAwsConfig)

    return new NixOSBoxManager(config.name, {
        cloud: awsBoxManager,
        nixos: config.spec.nixos,
        ssh: config.spec.ssh
    })
}

