import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from "fs"

// commonJS import
import sshpk from 'sshpk';
export const { parseKey, parsePrivateKey } = sshpk;
import upath from 'upath';
export const { joinSafe } = upath;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

export const CONFIGS_DIR = joinSafe(CURRENT_DIR, "..", "configs");
export const NIX_CONFIGS_DIR = joinSafe(CONFIGS_DIR, "nix")
export const WOLF_CONFIGS_DIR = joinSafe(CONFIGS_DIR, "wolf")

export async function parseSshPrivateKeyToPublic(keyPath: string){
    const privateKey = fs.readFileSync(keyPath, { encoding: 'utf8' });
    const privKey = parseKey(privateKey, "ssh-private")
    return privKey.toString("ssh")
}