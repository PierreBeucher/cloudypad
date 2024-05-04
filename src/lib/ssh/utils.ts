import * as path from 'path';
import sshpk from 'sshpk';
export const { parseKey, parsePrivateKey } = sshpk;
import * as fs from "fs"
import { mainLogger } from '../logging.js';

/**
 * Find the most suitable user's SSH Private key
 */
export async function getUserSSHPrivateKey(privateKeyPath?: string): Promise<string> {
    if (privateKeyPath){
        return fs.promises.readFile(privateKeyPath, { encoding: 'utf8' });
    }

    const keyPath = await getUserSSHPrivateKeyPath()
    return fs.promises.readFile(keyPath, { encoding: 'utf8' });
}

export async function getUserSSHPrivateKeyPath(): Promise<string> {
    const sshDir = path.join(process.env.HOME || '', '.ssh');
    const keyFilenames = ['id_rsa', 'id_ecdsa', 'id_ed25519'];

    for (const filename of keyFilenames) {
        const filePath = path.join(sshDir, filename);
        if (fs.existsSync(filePath)) {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile()) {
                mainLogger.info(`Found private key file: ${filePath}`)
                return filePath
            }
        }
    }

    throw new Error("Couldn't find suitable SSH private key file.")
}


export async function parseSshPrivateKeyFileToPublic(keyPath: string){
    const kData = fs.readFileSync(keyPath, { encoding: 'utf8' });
    return parseSshPrivateKeyToPublic(kData)
}

export async function parseSshPrivateKeyToPublic(keyData: string){
    const privKey = parseKey(keyData, "ssh-private")
    return privKey.toString("ssh")
}

/**
 * Find the most suitable user's SSH Private key to
 * use for Box management
 */
export async function getUserSSHPublicKey(privateKeyPath?: string): Promise<string>{

    // Find or generate the public SSH key to provision instance in this order:
    // - If private key is provided, use it 
    // - Otherwise, find first available private key
    // Then generate a public key out of it
    if (privateKeyPath) {
        return parseSshPrivateKeyFileToPublic(privateKeyPath)
    } else {
        const userPrivKeyPath = await getUserSSHPrivateKeyPath()
        return parseSshPrivateKeyFileToPublic(userPrivKeyPath)
    }
}