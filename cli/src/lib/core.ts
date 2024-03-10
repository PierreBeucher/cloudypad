import { getWolfAWSBox } from "../boxes/gaming/wolf.js";

// TODO generic config
export function getBoxManager(boxName: string) {

    return getWolfAWSBox(boxName, {
        instanceType: "g5.xlarge",
        sshPrivateKeyPath: "/home/pbeucher/.ssh/id_ed25519",
        region: "eu-central-1"

    })
}   

