import { PortDefinition, SSHDefinitionZ, STANDARD_SSH_PORTS } from "../common/virtual-machine.js";
import { z } from "zod";
import { BaseBox, BoxConstructorMetadata, ManagerBox, BoxSchemaBaseZ, DeepPartial, buildMainBoxMeta } from "../common/base.js";
import lodash from 'lodash';
import { NixOSBoxConfig, NixOSBoxConfigZ, NixOSManagerBox, NixOSManagerBoxBuilder, NixOSProjectSpec } from "../nix/manager.js";
import { ReplicatedEC2InstanceProjectSpec, ReplicatedEC2InstanceProjectSpecZ } from "../aws/replicated-ec2.js";
import { DnsSchema, NetworkSchema } from "../aws/common.js";
import { parseProvisionerName } from "../common/provisioners.js";
import { PaperspaceProjectSpec, PaperspaceProjectSpecZ } from "../paperspace/manager.js";
const { merge } = lodash;

export const SunshineProjectSchemaZ = BoxSchemaBaseZ.extend({
    // Almost like NixOSManagerBoxSpecZ except most is optional
    spec: z.object({
        nixos: NixOSBoxConfigZ.optional(),
        ssh: SSHDefinitionZ,
        dns: DnsSchema.optional(),
        network: NetworkSchema.optional(),
        provisioner: z.object({
            aws: ReplicatedEC2InstanceProjectSpecZ.deepPartial().optional(), 
            paperspace: PaperspaceProjectSpecZ.deepPartial().optional()
        })
    })
})
.strict()

export type SunshineProjectSchema = z.infer<typeof SunshineProjectSchemaZ>

export const PROJECT_KIND_GAMING_SUNSHINE = "gaming.Sunshine"

export interface SunshineManagerBoxArgs {
    nixosManager: NixOSManagerBox
}

/**
 * Sunshine ports
 * See https://docs.lizardbyte.dev/projects/sunshine/en/latest/about/advanced_usage.html#port
 */
export const SUNSHINE_PORTS : PortDefinition[] = [
    { from: 47984, protocol: "tcp" }, // HTTP
    { from: 47989, protocol: "tcp" }, // HTTPS
    { from: 47990, protocol: "tcp" }, // Web
    { from: 48010, protocol: "tcp" }, // RTSP
    
    { from: 47998, protocol: "udp" }, // Video
    { from: 47999, protocol: "udp" }, // Control
    { from: 48000, protocol: "udp" }, // Audio
    { from: 48002, protocol: "udp" }, // Mic (unused)
]

/**
 * Manages a Cloud VM and install Sunshine on it. Use an underlying NixOSManagerBox. 
 */
export class SunshineManagerBox extends BaseBox implements ManagerBox {

    static async parseSpec(rawConfig: unknown) : Promise<SunshineManagerBox> {
        return parseSunshineBoxSpec(rawConfig)
    }

    readonly args: SunshineManagerBoxArgs

    constructor(meta: BoxConstructorMetadata, args: SunshineManagerBoxArgs){
        super({ name: meta.name, project: meta.project, type: PROJECT_KIND_GAMING_SUNSHINE})
        this.args = args
    }

    deploy() {
         return this.args.nixosManager.deploy()
    }

    provision() {
        return this.args.nixosManager.provision()
    }
    
    destroy() {
        return this.args.nixosManager.destroy()
    }

    preview() {
        return this.args.nixosManager.preview()
    }

    refresh() {
        return this.args.nixosManager.refresh()
    }

    configure() {
        return this.args.nixosManager.configure()
    }

    get() {
        return this.args.nixosManager.get()
    }

    stop() {
        return this.args.nixosManager.stop()
    }

    start() {
        return this.args.nixosManager.start()
    }

    restart() {
        return this.args.nixosManager.restart()
    }

}

export async function parseSunshineBoxSpec(rawConfig: unknown) : Promise<SunshineManagerBox> {
    
    const parsedConfig = SunshineProjectSchemaZ.safeParse(rawConfig)
    if (!parsedConfig.success) {
        throw new Error(`Config parse errors: ${JSON.stringify(parsedConfig.error.issues, undefined, 2)}`)
    }

    const spec = parsedConfig.data.spec

    // NixOS specs based on Sunshine spec
    const nixosSpec: NixOSProjectSpec = {
        replicas: ["instance"],
        provisioner: spec.provisioner,
        dns: spec.dns,
        network: spec.network,
        ssh: spec.ssh,
        nixos: spec.nixos
    }

    // Additional ports for Sunshine (Moonlight protocol)
    const requiredPorts = STANDARD_SSH_PORTS
        .concat(SUNSHINE_PORTS)

    const provisionerName = parseProvisionerName(spec.provisioner)

    // Adapt provisioners for Sunshine
    switch (provisionerName) {
        case "aws": {
            const awsArgs: DeepPartial<ReplicatedEC2InstanceProjectSpec> = {
                instance: {
                    // Need a GPU instance with generous disk
                    type: "g5.xlarge",
                    rootVolume: {
                        sizeGb: 150
                    }
                },
                network: {
                    ingressPorts: requiredPorts,
                },
            }

            nixosSpec.provisioner.aws = merge(awsArgs, spec.provisioner.aws)

            break
        }
        case "paperspace": {
            const paperspaceArgs: DeepPartial<PaperspaceProjectSpec> = {
                machineType: "RTX4000",
                region: "Europe (AMS1)",
            }

            nixosSpec.provisioner.paperspace = merge(paperspaceArgs, spec.provisioner.paperspace)

            break
        }
    }

    // Add Sunshine modules
    const nixosConf: DeepPartial<NixOSBoxConfig> = {
        modules: [{
            path: "src/lib/nix/modules/sunshine-nvidia.nix",
        }, {
            path: "src/lib/nix/modules/sunshine",
            skipImport: true,
        }],
    }

    nixosSpec.nixos = merge(nixosConf, nixosSpec.nixos)

    const nixosBuilder = new NixOSManagerBoxBuilder({ spec: nixosSpec })
    const nixosManager = await nixosBuilder.buildManagerBox(buildMainBoxMeta(parsedConfig.data))
    
    return new SunshineManagerBox(buildMainBoxMeta(parsedConfig.data), { nixosManager: nixosManager })
}