import { PortDefinition } from "../../lib/infra/pulumi/components/security.js";
import { NixOSBoxArgs, NixOSBoxManager } from "../nix/nixos.js";
import * as logging from "../../lib/logging.js"
import { EC2InstanceBoxManager } from "../aws/ec2-instance.js";
import { CloudVMBoxManager, STANDARD_SSH_PORTS } from "../common/cloud-virtual-machine.js";
import { parseSshPrivateKeyToPublic } from "../../utils.js";

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

export interface WolfBoxArgs extends NixOSBoxArgs {

}

export class WolfBoxManager extends NixOSBoxManager {

    readonly args: WolfBoxArgs

    constructor(args: WolfBoxArgs){
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
            await this.reboot() 
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

export interface WolfAWSBoxArgs {
    region?: string,
    instanceType: string
    sshPrivateKeyPath: string,
}

/**
 * Build a Wolf box for AWS
 */
export function getWolfAWSBox(name: string, args: WolfAWSBoxArgs) : CloudVMBoxManager {


    const awsBm = new EC2InstanceBoxManager(`wolf-${name}`, { 
        aws: { region: args.region },
        infraArgs: {
            instance: {
                ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
                type: args.instanceType,
                publicKey: parseSshPrivateKeyToPublic(args.sshPrivateKeyPath),
                rootVolume: {
                    sizeGb: 150
                }
            },
            ingressPorts: STANDARD_SSH_PORTS.concat(WOLF_PORTS),
        },
    })

    return new WolfBoxManager({ 
        nixosConfigName: "wolf-aws",
        nixosChannel: "nixos-23.05",
        homeManagerRelease: "release-23.05",
        infraBoxManager: awsBm,
        ssh: {
            privateKeyPath: args.sshPrivateKeyPath
        }
    })
}