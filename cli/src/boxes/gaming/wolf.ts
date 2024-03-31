import * as logging from "../../lib/logging.js"
import { PortDefinition, SSHDefinitionZ, STANDARD_SSH_PORTS } from "../common/virtual-machine.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";
import { z } from "zod";
import { BoxSchemaBaseZ } from "../common/base.js";
import lodash from 'lodash';
import { NixOSBoxConfig, NixOSBoxConfigZ } from "../nix/configurator.js";
import { SSHClient } from "../../lib/ssh/client.js";
import { ReplicatedNixOSBoxManager, ReplicatedNixOSBoxManagerArgs } from "../nix/manager.js";
import { ReplicatedEC2BoxManager, ReplicatedEC2InstanceBoxManagerArgs, ReplicatedEC2InstanceSchema } from "../aws/replicated-ec2.js";
import { DnsSchema, NetworkSchema } from "../aws/common.js";
const { merge } = lodash;

export const WolfBoxSchemaZ = BoxSchemaBaseZ.extend({
    // Almost like ReplicatedNixOSBoxManagerSpecZ except most is optional
    spec: z.object({
        nixos: NixOSBoxConfigZ.optional(),
        ssh: SSHDefinitionZ,
        dns: DnsSchema.optional(),
        network: NetworkSchema.optional(),
        provider: z.object({
            aws: ReplicatedEC2InstanceSchema.partial()
        })
    })
})
.strict()

export type WolfBoxSchema = z.infer<typeof WolfBoxSchemaZ>

export interface WolfBoxManagerArgs extends ReplicatedNixOSBoxManagerArgs {

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

export const BOX_KIND_GAMING_WOLF = "gaming.Wolf.Manager"

/**
 * Manages a Cloud VM and install Wolf on it. 
 */
export class WolfBoxManager extends ReplicatedNixOSBoxManager {

    static async parseSpec(rawConfig: unknown) : Promise<WolfBoxManager> {
        return parseWolfBoxSpec(rawConfig)
    }

    constructor(name: string, args: WolfBoxManagerArgs){
        super(name, { 
            ...args, 
            additionalConfigSteps: [ async (ssh: SSHClient) => {
                await this.configureWolf(ssh) 
            }]
        }, BOX_KIND_GAMING_WOLF)
    }

    private async configureWolf(ssh: SSHClient) {

        // It may be needed to restart instance after initial driver installation
        // Check for presence of /sys/module/nvidia/version
        // If not present, restart needed, otherwise we're good to go
        // If still absent after reboot, something went wrong
        logging.ephemeralInfo("   Checking GPU drivers...")

        let nvidiaReady = false
        const cmdRes = await ssh.command(["cat", "/sys/module/nvidia/version"], { ignoreNonZeroExitCode: true})
        if(cmdRes.code == 0){
            nvidiaReady = true
        }

        logging.ephemeralInfo(`Nvidia driver check result: ${JSON.stringify(cmdRes)}`)

        if(!nvidiaReady) {
            logging.ephemeralInfo(`Nvidia driver version file not found, rebooting...`)
            await this.restart() 
            logging.ephemeralInfo(`Waiting for instance to start after reboot...`)
            await ssh.waitForConnection()
        }

        logging.info("   GPU drivers ready !")
    }

    async getWolfPinUrl(): Promise<string[]>{
        const pinSshResults = await this.runSshCommand(["sh", "-c", "docker logs wolf-wolf-1 2>&1 | grep -a 'Insert pin at' | tail -n 1"])

        const urlRegex = /(http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/pin\/#[0-9A-F]+)/;
        const urls = pinSshResults.map(res => {
            const match = res.sshRes.stdout.match(urlRegex)
            
            if (match) {
                const url = match[0];
                const replacedUrl = url.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, res.replica.publicIp);
    
                return replacedUrl
            } else {
                throw new Error("PIN validation URL not found in Wolf logs.");
            }
        });
        
        return urls
        
    }
}

/**
 * Build a Wolf box for AWS
 */
export async function parseWolfBoxSpec(rawConfig: unknown) : Promise<WolfBoxManager> {

    const config = await WolfBoxSchemaZ.parseAsync(rawConfig)

    const ports = STANDARD_SSH_PORTS
        .concat(WOLF_PORTS)

    const defaultAwsConfig: ReplicatedEC2InstanceBoxManagerArgs = {
        spec: {
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
            },
        } 
    }

    const finalAwsConfig = merge(defaultAwsConfig, config.spec.provider.aws)
    const awsBoxManager = new ReplicatedEC2BoxManager(`${BOX_KIND_GAMING_WOLF}-${config.name}`, finalAwsConfig)
    
    const nixosConf : NixOSBoxConfig = {
        nixosChannel: config.spec.nixos?.nixosChannel || "nixos-23.05",
        homeManagerRelease: config.spec.nixos?.homeManagerRelease || "release-23.05",
        nixosConfigName: "wolf-aws",
    }

    const finalNixosConfig = merge(nixosConf, config.spec.nixos)

    return new WolfBoxManager(config.name, { 
        provider: awsBoxManager,
        spec: {
            nixos: finalNixosConfig,
            replicas: [ "wolf" ], // single replica
            ssh: config.spec.ssh,
            provider: config.spec.provider,
        }
    })
}