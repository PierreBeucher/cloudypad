import { PortDefinition, SSHDefinitionZ, STANDARD_SSH_PORTS } from "../common/virtual-machine.js";
import { z } from "zod";
import { BaseBox, BoxConstructorMetadata, ManagerBox, BoxSchemaBaseZ, DeepPartial, buildMainBoxMeta } from "../common/base.js";
import lodash from 'lodash';
import { SSHClient } from "../../lib/ssh/client.js";
import { NixOSBoxConfig, NixOSBoxConfigZ, NixOSManagerBox, NixOSManagerBoxBuilder, NixOSProjectSpec } from "../nix/manager.js";
import { ReplicatedEC2InstanceProjectSpec, ReplicatedEC2InstanceProjectSpecZ } from "../aws/replicated-ec2.js";
import { DnsSchema, NetworkSchema } from "../aws/common.js";
import { NixOSConfigStep, NixOSConfigurator } from "../../lib/nix/configurator.js";
import { parseProvisionerName } from "../common/provisioners.js";
import { PaperspaceProjectSpec, PaperspaceProjectSpecZ } from "../paperspace/manager.js";
const { merge } = lodash;

export const WolfProjectSchemaZ = BoxSchemaBaseZ.extend({
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

export type WolfProjectSchema = z.infer<typeof WolfProjectSchemaZ>

export const PROJECT_KIND_GAMING_WOLF = "gaming.Wolf"

export interface WolfManagerBoxArgs {
    nixosManager: NixOSManagerBox
}

/**
 * Wolf ports
 * See https://games-on-whales.github.io/wolf/stable/user/quickstart.html
 */
export const WOLF_PORTS : PortDefinition[] = [
    { from: 47984, protocol: "tcp" }, // HTTP
    { from: 47989, protocol: "tcp" }, // HTTPS
    { from: 48010, protocol: "tcp" }, // RTSP
    { from: 47999, protocol: "udp" }, // Control
    { from: 48100, to: 48110, protocol: "udp" }, // Video (up to 10 users)
    { from: 48200, to: 48210, protocol: "udp" }, // Audio (up to 10 users)
]

/**
 * Manages a Cloud VM and install Wolf on it. Use an underlying NixOSManagerBox. 
 */
export class WolfManagerBox extends BaseBox implements ManagerBox {

    static async parseSpec(rawConfig: unknown) : Promise<WolfManagerBox> {
        return parseWolfBoxSpec(rawConfig)
    }

    readonly args: WolfManagerBoxArgs

    constructor(meta: BoxConstructorMetadata, args: WolfManagerBoxArgs){
        super({ name: meta.name, project: meta.project, type: PROJECT_KIND_GAMING_WOLF})
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
    
    async getWolfPinUrl(): Promise<string[]>{
        const pinSshResults = await this.args.nixosManager.runSshCommand([
            "sh", "-c", 
            "docker logs wolf-wolf-1 2>&1 | grep -a 'Insert pin at' | tail -n 1"
        ])

        const urlRegex = /(http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/pin\/#[0-9A-F]+)/;
        const urls = pinSshResults.map(res => {
            const match = res.sshRes.stdout.match(urlRegex)
            
            if (match) {
                const url = match[0];
                const replacedUrl = url.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, res.configurator.instance.hostname);
    
                return replacedUrl
            } else {
                throw new Error("PIN validation URL not found in Wolf logs.");
            }
        });
        
        return urls
        
    }
}

/**
 * Additional config step for Wolf on NixOS. Check NVidia driver are successfully installed and ready,
 * which may require a restart after initial switch to Wolf-ready config.
 */
export const nixosWolfConfig: NixOSConfigStep = async (box: NixOSConfigurator, ssh: SSHClient) => {
    // Check for presence of /sys/module/nvidia/version
    // If not present, restart needed, otherwise we're good to go
    // If still absent after reboot, something went wrong
    box.logger.info("Checking GPU drivers...")

    let nvidiaReady = false
    const cmdRes = await ssh.command(["cat", "/sys/module/nvidia/version"], { ignoreNonZeroExitCode: true})
    if(cmdRes.code == 0){
        nvidiaReady = true
    }

    box.logger.info(`Nvidia driver check result: ${JSON.stringify(cmdRes)}`)

    if(!nvidiaReady) {
        box.logger.info(`Nvidia driver version file not found, rebooting...`)
        await box.restart() 
        box.logger.info(`Waiting for instance to start after reboot...`)
        await ssh.waitForConnection()

        // TODO check nvidia again
    }

    box.logger.info("GPU drivers ready !")
};

export async function parseWolfBoxSpec(rawConfig: unknown) : Promise<WolfManagerBox> {
    
    const parsedConfig = WolfProjectSchemaZ.safeParse(rawConfig)
    if (!parsedConfig.success) {
        throw new Error(`Config parse errors: ${JSON.stringify(parsedConfig.error.issues, undefined, 2)}`)
    }

    const spec = parsedConfig.data.spec

    // NixOS specs based on Wolf spec
    const nixosSpec: NixOSProjectSpec = {
        replicas: ["instance"],
        provisioner: spec.provisioner,
        dns: spec.dns,
        network: spec.network,
        ssh: spec.ssh,
        nixos: spec.nixos
    }

    // Additional ports for Wolf (Moonlight protocol)
    const requiredPorts = STANDARD_SSH_PORTS
        .concat(WOLF_PORTS)

    const provisionerName = parseProvisionerName(spec.provisioner)

    // Adapt provisioners for Wolf
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

    // Add Wolf modules
    const nixosConf: DeepPartial<NixOSBoxConfig> = {
        modules: [{
            path: "src/lib/nix/modules/wolf-nvidia.nix",
        }, {
            path: "src/lib/nix/modules/wolf",
            skipImport: true,
        }],
    }

    nixosSpec.nixos = merge(nixosConf, nixosSpec.nixos)

    const nixosBuilder = new NixOSManagerBoxBuilder({ spec: nixosSpec, additionalConfigSteps: [ nixosWolfConfig ]})
    const nixosManager = await nixosBuilder.buildManagerBox(buildMainBoxMeta(parsedConfig.data))
    
    return new WolfManagerBox(buildMainBoxMeta(parsedConfig.data), { nixosManager: nixosManager })
}