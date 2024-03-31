import { describe, expect, test } from 'vitest'
import { parseSshPrivateKeyToPublic } from "../../src/utils";

describe('check utils function', () => {

    test('parseSshPrivateKeyToPublic', async () => {
        
        const pubKey = await parseSshPrivateKeyToPublic("tests/resources/id_test")
        expect(pubKey).toEqual("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAZNhhS5xRMaLZ77mJYNL/QoW03fZzRLTDHtfmczc+bX (unnamed)")
        
    });
});