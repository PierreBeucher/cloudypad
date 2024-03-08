import { ConfigMap } from "@pulumi/pulumi/automation";
import { NixOSBoxManager } from "./nixos.js";
import {     PulumiBoxManager, PulumiBoxOutput } from "./pulumi.js";
import { WolfEC2IntanceStackOutput, wolfEc2InstanceProgram } from "../lib/infra/pulumi/programs/wolf.js";
import * as fs from 'fs'
import * as logging from "../lib/logging.js"

export interface WolfAWSBoxArgs {
    aws: {
        region: string
    }
    sshPublicKeyPath: string
    sshPrivateKeyPath: string
    nixosAmi: string
}

export class WolfAWSBoxManager {

    args: WolfAWSBoxArgs
    name: string

    constructor(name: string, args: WolfAWSBoxArgs){
        this.name = name
        this.args = args
    }

    preview(): Promise<string> {
        return this.getPulumiBoxManager().preview()
    }

    async deploy() {
        await this.getPulumiBoxManager().deploy()
        await (await this.getNixosBoxManager()).deploy()
    }
    
    async destroy() {
        await this.getPulumiBoxManager().destroy()
    }

    async get() {
        return this.getPulumiBoxManager().get()
    }

    async reboot(){
        const bm = await this.getNixosBoxManager()
        await bm.runSshCommand(["reboot"])
    }

    async provision() {
       const box = await this.getNixosBoxManager()
       await box.deploy()

       // It may be needed to restart instance after initial deployment
       // Check for presence of /sys/module/nvidia/version
       // If not present, restart needed, otherwise we're good to go
       // If still absent after reboot, something went wrong
       const checkNvidia = await this.checkNvidiaReady()
       if(!checkNvidia) {
            logging.ephemeralInfo(`Nvidia driver version file not found, rebooting...`)
            await this.reboot() 
            logging.ephemeralInfo(`Waiting for instance to start after reboot...`)
            await box.waitForSsh()
       }
    }

    private async checkNvidiaReady(): Promise<boolean>{
        const box = await this.getNixosBoxManager()
        const cmdRes = await box.runSshCommand(["cat", "/sys/module/nvidia/version"], { ignoreNonZeroExitCode: true})
        if(cmdRes.code == 0){
            return true
       } else {
            return false
       }
    }

    async getWolfPinUrl(): Promise<string>{
        const box = await this.getNixosBoxManager()
        
        const sshResp = await box.runSshCommand(["sh", "-c", "docker logs wolf-wolf-1 2>&1 | grep -a 'Insert pin at' | tail -n 1"])

        const urlRegex = /(http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+\/pin\/#[0-9A-F]+)/;
        const match = sshResp.stdout.match(urlRegex);
        
        if (match) {
            const url = match[0];
            const replacedUrl = url.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, box.args.host);

            return replacedUrl
        } else {
            throw new Error("PIN validation URL not found in Wolf logs.");
        }
    }

    private buildOutputFromStack(boxOutput: PulumiBoxOutput): WolfEC2IntanceStackOutput{
        const stackOutputs = boxOutput.outputs
        
        return {
            ipAddress: stackOutputs["ipAddress"].value
        }
    }

    private getPulumiBoxManager(){
        const pulumiConfig : ConfigMap = {
            "aws:region": { value: this.args.aws.region },
        }

        const publicKey = fs.readFileSync(this.args.sshPublicKeyPath, "utf8")
        
        return new PulumiBoxManager({
            name:  this.name,
            projectName: "wolf-aws",
            program: async () => {
                return wolfEc2InstanceProgram(this.name, { 
                    publicSshKey: publicKey,
                    nixosAmi: this.args.nixosAmi
                })
            },
            config: pulumiConfig
        })
    }

    private async getNixosBoxManager(){
        const result = await this.getPulumiBoxManager().get()
        const outputs = this.buildOutputFromStack(result)

        return new NixOSBoxManager({
            host: outputs.ipAddress,
            ssh: {
                port: 22,
                user: "root",
                privateKeyPath: this.args.sshPrivateKeyPath
            },
            nixosConfigName: "wolf-aws",
            nixosChannel: "nixos-23.05", // TODO config?
            homeManagerRelease: "release-23.05" // TODO config?
        })
    }

}