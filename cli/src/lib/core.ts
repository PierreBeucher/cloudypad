import { EC2InstanceBoxManager } from "../boxes/aws/ec2-instance.js"
import * as fs from 'fs'
import { WOLF_PORTS, WolfBoxManager } from "../boxes/gaming/wolf.js"
import { STANDARD_SSH_PORTS } from "../boxes/common/cloud-virtual-machine.js"

// TODO generic config
export function getBoxManager(boxName: string) {

    const awsBm = new EC2InstanceBoxManager(boxName, { 
        aws: { region: "eu-central-1" },
        infraArgs: {
            instance: {
                ami: "ami-024965d66b21fb7ab", // nixos/23.11.5060.617579a78725-x86_64-linux eu-central-1
                type: "g5.xlarge",
                publicKey: fs.readFileSync("/home/pbeucher/.ssh/id_ed25519.pub", "utf-8"),
                rootVolume: {
                    sizeGb: 150
                }
            },
            ingressPorts: STANDARD_SSH_PORTS.concat(WOLF_PORTS),
        },
    })

    const nixosBm = new WolfBoxManager({ 
        nixosConfigName: "wolf-aws",
        nixosChannel: "nixos-23.05",
        homeManagerRelease: "release-23.05",
        infraBoxManager: awsBm,
        ssh: {
            privateKeyPath: "/home/pbeucher/.ssh/id_ed25519"
        }
    })

    return nixosBm
}   

