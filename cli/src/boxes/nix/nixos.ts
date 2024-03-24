import lodash from 'lodash';
const { merge } = lodash;
import { NixOSConfigurator } from "../../lib/configurator/nixos.js";
import { SSHClient, SSHCommandOpts } from "../../lib/configurator/ssh.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { CompositeEC2InstanceBoxManagerArgsZ, CompositeEC2BoxManager, EC2InstanceBoxManagerArgs } from "../aws/composite-ec2.js";
import { BoxSchemaBaseZ, BoxMetadata } from "../common/base.js";
import { CloudVMBoxManager, CloudVMBoxManagerOutputs, SSHConfig, SUBSCHEMA_SSH_DEFINITION } from "../common/cloud-virtual-machine.js";
import { z } from "zod";
import * as logging from "../../lib/logging.js"

export const SUBSCHEMA_NIXOS_CONFIG = z.object({
    nixosConfigName: z.string(),
    nixosChannel: z.string(),
    homeManagerRelease: z.optional(z.string())
}).strict()

export const BOX_SPEC_NIXOS = z.object({
    nixos: SUBSCHEMA_NIXOS_CONFIG,
    ssh: SUBSCHEMA_SSH_DEFINITION,
    cloud: z.object({
        aws: CompositeEC2InstanceBoxManagerArgsZ.partial().strict()
    })
}).strict()

export const BOX_SCHEMA_NIXOS = BoxSchemaBaseZ.extend({
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

export const BOX_KIND_LINUX_NIXOS = "linux.NixOS"

export class NixOSBoxManager extends CloudVMBoxManager {

    static parseSpec = parseLinuxNixOSBoxSpec

    readonly args: NixOSBoxManagerArgs

    constructor(name: string, args: NixOSBoxManagerArgs, kind = BOX_KIND_LINUX_NIXOS) {
        super(new BoxMetadata({ name: name, kind: kind}))
        this.args = args
    }

    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    public async provision() {
        const o = await this.args.cloud.provision()
        await this.configure()
        return o
    }

    public async configure() {
        const o = await this.get()
        logging.info("   Configuring NixOS instance...")

        await this.doWaitForSsh(o)

        const nixosPrv = this.buildNixosConfigurator(o)
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

    public async get(): Promise<CloudVMBoxManagerOutputs> {
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

    private async doWaitForSsh(o: CloudVMBoxManagerOutputs){
        const ssh = this.buildSshClient(o)
        try {
            return await ssh.waitForConnection()
        } finally {
            ssh.dispose()
        }
    }

    private async doRunSshCommand(o: CloudVMBoxManagerOutputs, cmd: string[], opts?: SSHCommandOpts){
        const ssh = this.buildSshClient(o)        
        try {
            await ssh.connect()
            return await ssh.command(cmd, opts)
        } finally {
            ssh.dispose();
        }
    }

    private buildNixosConfigurator(o: CloudVMBoxManagerOutputs){
        return new NixOSConfigurator({
            host: o.ipAddress,
            port: this.args.ssh.port,
            sshKeyPath: this.args.ssh.privateKeyPath
        })
    }

    private buildSshClient(o: CloudVMBoxManagerOutputs){
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
        awsConfig: {
            region: "eu-central-1" // TODO from user environment?
        }, 
        publicKey: await parseSshPrivateKeyToPublic(config.spec.ssh.privateKeyPath),
        instance: {
            ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
            type: "t3.small", // TODO not as default ? May be hard for update
            rootVolume: {
                sizeGb: 16 // NixOS needs generous amount of disk by default
            }
        },
        network: {
            ingressPorts: [{
                from: 22
            }]
        }
    }
    const finalAwsConfig = merge(defaultAwsConfig, config.spec.cloud.aws)

    const awsBoxManager = new CompositeEC2BoxManager(`nixos-${config.name}`, finalAwsConfig)

    return new NixOSBoxManager(config.name, {
        cloud: awsBoxManager,
        nixos: config.spec.nixos,
        ssh: config.spec.ssh
    })
}

