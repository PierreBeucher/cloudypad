import * as assert from 'assert'
import { generatePrivateSshKey, SshKeyLoader } from '../../../src/tools/ssh'
import { DUMMY_SSH_KEY_PATH, DUMMY_SSH_PUBLIC_KEY_PATH } from '../utils'
import { CommonProvisionInputV1 } from '../../../src/core/state/state'
import { toBase64 } from '../../../src/tools/base64'
import * as fs from 'fs'

describe('SshKeyLoader', () => {
    const sshKeyLoader = new SshKeyLoader()

    it('should return private key path using private key path', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyPath: DUMMY_SSH_KEY_PATH
        }
        const actualAuth = sshKeyLoader.getSshAuth(ssh)
        assert.strictEqual(actualAuth.privateKeyPath, ssh.privateKeyPath)
    })

    it('should return private key path using string content', () => {
        const sshPrivateKeyContent = "dummy-private-key-content"
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyContentBase64: toBase64(sshPrivateKeyContent)
        }
        
        const actualAuth = sshKeyLoader.getSshAuth(ssh)
        assert.ok(actualAuth.privateKeyPath)

        const actualPrivateKeyContent = fs.readFileSync(actualAuth.privateKeyPath, { encoding: 'utf8' })
        assert.strictEqual(actualPrivateKeyContent, sshPrivateKeyContent)
    })

    it('should return password using password base64', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            passwordBase64: toBase64("dummy-password")
        }
        const actualAuth = sshKeyLoader.getSshAuth(ssh)
        assert.strictEqual(actualAuth.password, "dummy-password")
    })

    it('should throw an error if no private key or password is provided', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user"
        }
        assert.throws(() => sshKeyLoader.getSshAuth(ssh), /No SSH private key or password provided/)
    })

    it('should return key path if both private key and key content are provided', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyPath: DUMMY_SSH_KEY_PATH,
            privateKeyContentBase64: toBase64(fs.readFileSync(DUMMY_SSH_KEY_PATH, { encoding: 'utf8' }))
        }
        const actualAuth = sshKeyLoader.getSshAuth(ssh)
        assert.strictEqual(actualAuth.privateKeyPath, ssh.privateKeyPath)
    })

    it('should return key path and password if both private key and password are provided', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyPath: DUMMY_SSH_KEY_PATH,
            passwordBase64: toBase64("dummy-password")
        }
        const actualAuth = sshKeyLoader.getSshAuth(ssh)
        assert.strictEqual(actualAuth.privateKeyPath, ssh.privateKeyPath)
        assert.strictEqual(actualAuth.password, "dummy-password")
    })

    it('should return public key content using private key path', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyPath: DUMMY_SSH_KEY_PATH
        }
        const publicKeyContent = sshKeyLoader._loadSshPublicKeyContent(ssh)
        assert.strictEqual(publicKeyContent.trim(), fs.readFileSync(DUMMY_SSH_PUBLIC_KEY_PATH, { encoding: 'utf8' }).trim())
    })

    it('should return public key content using string content', () => {
        const ssh: CommonProvisionInputV1["ssh"] = {
            user: "test-user",
            privateKeyContentBase64: toBase64(fs.readFileSync(DUMMY_SSH_KEY_PATH, { encoding: 'utf8' }))
        }
        const publicKeyContent = sshKeyLoader._loadSshPublicKeyContent(ssh)
        assert.strictEqual(publicKeyContent.trim(), fs.readFileSync(DUMMY_SSH_PUBLIC_KEY_PATH, { encoding: 'utf8' }).trim())
    })

    it('should generate a private key', () => {
        const privateKey = generatePrivateSshKey()
        
        assert.ok(privateKey.trim().startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"))
        assert.ok(privateKey.trim().endsWith("-----END OPENSSH PRIVATE KEY-----"))
    })
})
