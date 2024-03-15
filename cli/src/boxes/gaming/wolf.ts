import { PortDefinition } from "../../lib/infra/pulumi/components/security.js";
import { NixOSBoxManager, BOX_SPEC_NIXOS, NixOSBoxManagerArgs, NixOSBoxSpec } from "../nix/nixos.js";
import * as logging from "../../lib/logging.js"
import { EC2InstanceBoxManager } from "../aws/ec2-instance.js";
import { STANDARD_SSH_PORTS } from "../common/cloud-virtual-machine.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { z } from "zod";
import { BOX_SCHEMA_BASE } from "../common/base.js";

export const BOX_SPEC_WOLF = z.object({
    ssh: z.object({
        privateKeyPath: z.string(),
    }),
    nixos: z.optional(BOX_SPEC_NIXOS, { description: "NixOS spec overrides."}),
    aws: z.object({
        region: z.string(),
        instanceType: z.optional(z.string())
    })
})

export const BOX_SCHEMA_WOLF = BOX_SCHEMA_BASE.extend({
    spec: BOX_SPEC_WOLF
})

export type WolfBoxSchema = z.infer<typeof BOX_SCHEMA_WOLF>
export type WolfBoxSpec = z.infer<typeof BOX_SPEC_WOLF>

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

export class WolfBoxManager extends NixOSBoxManager {

    readonly args: WolfBoxManagerArgs

    constructor(args: WolfBoxManagerArgs){
        super(args)
        this.args = args
    }

    async provision() {
        const o = await super.provision()

        // It may be needed to restart instance after initial deployment
        // Check for presence of /sys/module/nvidia/version
        // If not present, restart needed, otherwise we're good to go
        // If still absent after reboot, something went wrong
        console.info("   Checking GPU drivers...")
        const checkNvidia = await this.checkNvidiaReady()

        if(!checkNvidia) {
            logging.ephemeralInfo(`Nvidia driver version file not found, rebooting...`)
            await this.restart() 
            logging.ephemeralInfo(`Waiting for instance to start after reboot...`)
            await this.waitForSsh()
        }

        console.info("   GPU drivers ready !")

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

export async function parseWolfBoxSpec(rawConfig: unknown) : Promise<WolfBoxManager> {
    const schema = await BOX_SCHEMA_WOLF.parseAsync(rawConfig)
    return buildWolfAWSBox(schema.name, schema.spec)
}

/**
 * Build a Wolf box for AWS
 */
export function buildWolfAWSBox(name: string, spec: WolfBoxSpec) : WolfBoxManager {

    const awsBm = new EC2InstanceBoxManager({
        name: `wolf-${name}`,
        aws: { region: spec.aws.region },
        infraArgs: {
            instance: {
                ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
                type: spec.aws.instanceType || "g5.xlarge",
                publicKey: parseSshPrivateKeyToPublic(spec.ssh.privateKeyPath),
                rootVolume: {
                    sizeGb: 150
                }
            },
            ingressPorts: STANDARD_SSH_PORTS.concat(WOLF_PORTS),
        },
    })

    const nixosBoxConf : NixOSBoxSpec = {
        nixosChannel: spec.nixos?.nixosChannel || "nixos-23.05",
        homeManagerRelease: spec.nixos?.homeManagerRelease || "release-23.05",
        nixosConfigName: "wolf-aws",
        ssh: {
            privateKeyPath: spec.ssh.privateKeyPath
        }
    }

    return new WolfBoxManager({
        name: name,
        infraBoxManager: awsBm,
        spec: nixosBoxConf
    })
}