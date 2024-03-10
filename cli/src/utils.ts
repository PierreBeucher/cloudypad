import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from "fs"

// commonJS import
import sshpk from 'sshpk';
export const { parseKey, parsePrivateKey } = sshpk;
import upath from 'upath';
export const { joinSafe } = upath;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

export const INFRA_DIR = joinSafe(CURRENT_DIR, "..", "..", "infra");
export const PROVISION_DIR = joinSafe(CURRENT_DIR, "..", "..", "provision");
export const NIX_PROVISION_DIR = joinSafe(PROVISION_DIR, "nix")
export const WOLF_PROVISION_DIR = joinSafe(PROVISION_DIR, "wolf")

export async function parseSshPrivateKeyToPublic(keyPath: string){
    const privateKey = fs.readFileSync(keyPath, { encoding: 'utf8' });
    const privKey = parseKey(privateKey, "ssh-private")
    return privKey.toString("ssh")
}