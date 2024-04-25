import { promises as fs } from 'fs';
import * as path from 'path';

export async function lookupSSHPrivateKey(): Promise<string | undefined> {
    const sshDir = path.join(process.env.HOME || '', '.ssh');
    const keyFilenames = ['id_rsa', 'id_ecdsa', 'id_ed25519'];

    for (const filename of keyFilenames) {
        const filePath = path.join(sshDir, filename);
        try {
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                const privateKey = await fs.readFile(filePath, { encoding: 'utf8' });
                return privateKey;
            }
        } catch (error) {
            console.error(`Error reading ${filePath}: ${error}`);
        }
    }
}
