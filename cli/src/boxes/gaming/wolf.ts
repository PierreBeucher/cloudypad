import { NixOSBoxManager, NixOSBoxManagerArgs, NixOSConfig, SUBSCHEMA_NIXOS_CONFIG } from "../nix/nixos.js";
import * as logging from "../../lib/logging.js"
import { CompositeEC2InstanceBoxManagerArgsZ, CompositeEC2BoxManager, EC2InstanceBoxManagerArgs } from "../aws/composite-ec2.js";
import { PortDefinition, STANDARD_SSH_PORTS, SUBSCHEMA_PORT_DEFINITION, SUBSCHEMA_SSH_DEFINITION } from "../common/cloud-virtual-machine.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { z } from "zod";
import { BoxSchemaBaseZ } from "../common/base.js";
import lodash from 'lodash';
const { merge } = lodash;

export const BOX_SCHEMA_WOLF = BoxSchemaBaseZ.extend({
    spec: z.object({
        ssh: SUBSCHEMA_SSH_DEFINITION,
        nixos: z.optional(SUBSCHEMA_NIXOS_CONFIG, { description: "NixOS config overrides."}),
        additionalPorts: z.optional(z.array(SUBSCHEMA_PORT_DEFINITION)),
        cloud: z.object({
            aws: CompositeEC2InstanceBoxManagerArgsZ.partial()
        })
    })
})
.strict()

export type WolfBoxSchema = z.infer<typeof BOX_SCHEMA_WOLF>

export interface WolfBoxManagerArgs extends NixOSBoxManagerArgs {

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

export const BOX_KIND_GAMING_WOLF = "gaming.Wolf"

export class WolfBoxManager extends NixOSBoxManager {

    static async parseSpec(rawConfig: unknown) : Promise<WolfBoxManager> {
        const config = await BOX_SCHEMA_WOLF.parseAsync(rawConfig)
        return buildWolfAWSBox(config)
    }

    readonly args: WolfBoxManagerArgs

    constructor(name: string, args: WolfBoxManagerArgs){
        super(name, args, BOX_KIND_GAMING_WOLF)
        this.args = args
    }

    async configure() {
        const o = await super.configure()

        // It may be needed to restart instance after initial driver installation
        // Check for presence of /sys/module/nvidia/version
        // If not present, restart needed, otherwise we're good to go
        // If still absent after reboot, something went wrong
        logging.info("   Checking GPU drivers...")
        const checkNvidia = await this.checkNvidiaReady()

        if(!checkNvidia) {
            logging.ephemeralInfo(`Nvidia driver version file not found, rebooting...`)
            await this.restart() 
            logging.ephemeralInfo(`Waiting for instance to start after reboot...`)
            await this.waitForSsh()
        }

        logging.info("   GPU drivers ready !")

        return o
    }

    private async checkNvidiaReady(): Promise<boolean>{
        const cmdRes = await this.runSshCommand(["cat", "/sys/module/nvidia/version"], { ignoreNonZeroExitCode: true})
        if(cmdRes.code == 0){
            return true
       } else {
            return false
       }
    }

    async getWolfPinUrl(): Promise<string>{
        const sshResp = await this.runSshCommand(["sh", "-c", "docker logs wolf-wolf-1 2>&1 | grep -a 'Insert pin at' | tail -n 1"])

        const urlRegex = /(http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/pin\/#[0-9A-F]+)/;
        const match = sshResp.stdout.match(urlRegex);
        
        if (match) {
            const o = await this.get()
            const url = match[0];
            const replacedUrl = url.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, o.ipAddress);

            return replacedUrl
        } else {
            throw new Error("PIN validation URL not found in Wolf logs.");
        }
    }
}

/**
 * Build a Wolf box for AWS
 */
export async function buildWolfAWSBox(config: WolfBoxSchema) : Promise<WolfBoxManager> {

    const ports = STANDARD_SSH_PORTS
        .concat(WOLF_PORTS)
        .concat(config.spec.additionalPorts || [])

    const defaultAwsConfig: EC2InstanceBoxManagerArgs = {
        awsConfig: { region: "eu-central-1" },
        publicKey: await parseSshPrivateKeyToPublic(config.spec.ssh.privateKeyPath),
        instance: {
            ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
            type: "g5.xlarge",
            rootVolume: {
                sizeGb: 150
            }
        },
        network: {
            ingressPorts: ports,
        }
    }

    const finalAwsConfig = merge(defaultAwsConfig, config.spec.cloud.aws)

    const awsBm = new CompositeEC2BoxManager(`wolf-${config.name}`, finalAwsConfig)
    
    // Default NixOS config overridable by user 
    const nixosConf : NixOSConfig = {
        nixosChannel: config.spec.nixos?.nixosChannel || "nixos-23.05",
        homeManagerRelease: config.spec.nixos?.homeManagerRelease || "release-23.05",
        nixosConfigName: "wolf-aws",
    }

    const finalNixosConfig = merge(nixosConf, config.spec.nixos)

    return new WolfBoxManager(config.name, {
        cloud: awsBm,
        nixos: finalNixosConfig,
        ssh: config.spec.ssh
    })
}