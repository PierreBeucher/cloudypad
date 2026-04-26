import { CloudypadClient } from "../../src/core/client";
import * as assert from 'assert'
import fs from "fs"
import path from "path"
import * as os from 'os'
import * as yaml from 'yaml'
import { CoreConfig } from "../../src/core/config/interface";
import { InstanceStateV1 } from "../../src/core/state/state";
import { AnsibleClient } from "../../src/tools/ansible";
import { SshKeyLoader } from "../../src/tools/ssh";
import { getLogger } from "../../src/log/utils";

const logger = getLogger("integ-test-utils")

export function getIntegTestCoreConfig(): CoreConfig {
    // ensure directory relative to this file ./tmp exists
    const integTestDataRootDir = path.join(__dirname, "./.data-root-dir")
    const pulumiBackendDir = path.join(integTestDataRootDir, "pulumi")
    fs.mkdirSync(integTestDataRootDir, { recursive: true })
    fs.mkdirSync(pulumiBackendDir, { recursive: true })
    
    const config: CoreConfig = {
        stateBackend: {
            local: {
                dataRootDir: integTestDataRootDir
            }
        },
        pulumi: {
            workspaceOptions: {
                envVars: {
                    PULUMI_BACKEND_URL: `file:///${pulumiBackendDir}`
                }
            }
        }
    }
    return config
}
/**
 * Create a Core client suitable for testing. The instance returned use the
 * a local data backend with a temporary directory which remains the same for all tests
 */
export function getIntegTestCoreClient(): CloudypadClient{
    return new CloudypadClient({
        config: getIntegTestCoreConfig()
    })
}

export interface RunVerifyPlaybookOpts {
    createDataDiskTestFile?: boolean
    checkDataDiskTestFile?: boolean
    skipRatelimitVerify?: boolean
}

/**
 * Run the verify.yml playbook against an instance.
 * Builds an Ansible inventory on the fly from current state and runs the cloudypad-check role.
 */
export async function runVerifyPlaybook(instanceName: string, state: InstanceStateV1, opts?: RunVerifyPlaybookOpts): Promise<void> {

    if(process.env.CLOUDYPAD_SKIP_CONFIGURATION === "true"){
        logger.warn("CLOUDYPAD_SKIP_CONFIGURATION is set - skipping verify playbook")
        return
    }

    assert.ok(state.provision.output, "Provision output must exist to run verify playbook")

    const sshAuth = new SshKeyLoader().getSshAuth(state.provision.input.ssh)

    const inventoryObject = {
        all: {
            hosts: {
                [instanceName]: {
                    ansible_host: state.provision.output.publicIPv4 ?? state.provision.output.host,
                    ansible_user: state.provision.input.ssh.user,
                    ansible_ssh_private_key_file: sshAuth.privateKeyPath,
                    ansible_password: sshAuth.password,

                    cloudypad_data_disk_id: state.provision.output.machineDataDiskLookupId,
                    cloudypad_data_disk_lookup_method: state.provision.output.machineDataDiskMountMethod ?? "default",

                    // if rate limit is skipped, always set ratelimit_enable to false
                    // otherwise only enable if instance input did provide a rate limit
                    ratelimit_enable: opts?.skipRatelimitVerify ? false : 
                        state.configuration.input.ratelimit?.maxMbps !== undefined && state.configuration.input.ratelimit.maxMbps > 0,

                    cloudypad_verify_create_data_disk_test_file: opts?.createDataDiskTestFile ?? false,
                    cloudypad_verify_data_disk_test_file: opts?.checkDataDiskTestFile ?? false,
                },
            },
        },
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-verify-'))
    const inventoryPath = path.join(tmpDir, 'inventory.yml')
    fs.writeFileSync(inventoryPath, yaml.stringify(inventoryObject), 'utf8')

    const playbookPath = path.resolve(__dirname, '..', '..', 'ansible', 'verify.yml')

    logger.info(`Running verify playbook: ${playbookPath} with inventory: ${inventoryPath}`)

    const ansible = new AnsibleClient()
    await ansible.runAnsible(inventoryPath, playbookPath, [
        '-e', '\'ansible_ssh_common_args="-o StrictHostKeyChecking=no"\'',
    ])
}
