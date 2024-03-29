import lodash from 'lodash';
const { merge } = lodash;
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { CompositeEC2InstanceBoxManagerArgsZ, CompositeEC2BoxManager, EC2InstanceBoxManagerArgs } from "../aws/composite-ec2.js";
import { BoxSchemaBaseZ, BoxBase, BoxManager } from "../common/base.js";
import { SSHDefinitionZ, VMBoxProvisioner, VMProvisionerBoxOutputs } from "../common/virtual-machine.js";
import { z } from "zod";
import { NixOSBoxConfigZ, NixOSBoxConfigurator, NixOSConfigStep } from './configurator.js';
import { SSHCommandOpts } from '../../lib/ssh/client.js';

export const NixOSBoxManagerSpecZ = z.object({
    nixos: NixOSBoxConfigZ,
    ssh: SSHDefinitionZ,
    provider: z.object({
        aws: CompositeEC2InstanceBoxManagerArgsZ.partial().strict()
    })
}).strict()

export const NixOSBoxManagerSchemaZ = BoxSchemaBaseZ.extend({
    spec: NixOSBoxManagerSpecZ
})

export type NixOSBoxManagerSpec = z.infer<typeof NixOSBoxManagerSpecZ>
export type NixOSBoxManagerSchema = z.infer<typeof NixOSBoxManagerSchemaZ>

export interface NixOSBoxManagerArgs {
    spec: NixOSBoxManagerSpec
    provider: VMBoxProvisioner
    additionalConfigSteps?: NixOSConfigStep[]
}

export const BOX_KIND_LINUX_NIXOS = "Linux.NixOS.Manager"

/**
 * Manages a cloud VM and NixOS configuration within. 
 */
export class NixOSBoxManager extends BoxBase implements BoxManager {

    static parseSpec = parseNixOSBoxManagerSpec

    readonly args: NixOSBoxManagerArgs

    constructor(name: string, args: NixOSBoxManagerArgs, kind = BOX_KIND_LINUX_NIXOS) {
        super({ name: name, kind: kind})
        this.args = args  
    }

    public async deploy() {
        await this.provision()
        const o = await this.configure()
        return o
    }

    public async provision() {
        const o = await this.args.provider.provision()
        await this.configure()
        return o
    }

    public async configure() {
        const c = await this.getConfigurator()
        return c.configure()
    }

    public async destroy(): Promise<void> {
        return this.args.provider.destroy()
    }

    public async preview(): Promise<string> {
        return this.args.provider.preview()
    }

    public async get(): Promise<VMProvisionerBoxOutputs> {
        return this.args.provider.get()
    }

    public async stop() {
        return this.args.provider.stop()
    }

    public async start() {
        return this.args.provider.start()
    }

    public async restart() {
        return this.args.provider.restart()
    }

    public async runSshCommand(cmd: string[], opts?: SSHCommandOpts){
        const c = await this.getConfigurator()
        return c.runSshCommand(cmd, opts)
    }

    /**
     * Build a NixOS configurator for this manager. To get a configuratir the NixOS VM must be known
     * which may not be the case if the box hasn't been provisioned yet. 
     * @returns 
     */
    private async getConfigurator(){
        const o = await this.get()
        return new NixOSBoxConfigurator(this.metadata.name, {
            spec: {
                ...this.args.spec,
                hostname: o.ipAddress
            },
            additionalSteps: this.args.additionalConfigSteps
        })
    }

}

export async function parseNixOSBoxManagerSpec(rawConfig: unknown) : Promise<NixOSBoxManager> {
    const config = await NixOSBoxManagerSchemaZ.parseAsync(rawConfig)

    // Default configuration for AWS
    const defaultAwsConfig: EC2InstanceBoxManagerArgs = {
        awsConfig: {
            region: "eu-central-1" // TODO default from user environment?
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
    const finalAwsConfig = merge(defaultAwsConfig, config.spec.provider.aws)

    const awsBoxManager = new CompositeEC2BoxManager(`nixos-${config.name}`, finalAwsConfig)

    return new NixOSBoxManager(config.name, {
        provider: awsBoxManager,
        spec: config.spec
    })
}

