
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { StateManager } from '../core/state';
import { InstanceConfigurator } from '../core/configurator';

export class AnsibleConfigurator implements InstanceConfigurator {

    readonly sm: StateManager

    constructor(sm: StateManager){
        this.sm = sm
    }

    async configure() {

        const state = this.sm.get()

        if(!state.ssh?.user || !state.ssh?.privateKeyPath) {
            throw new Error(`Can't configure instance: SSH user or private key unknwon in state: ${JSON.stringify(state)}`)
        }

        if(!state.host) {
            throw new Error(`Can't configure instance: hostname or public IP unknwon in state: ${JSON.stringify(state)}`)
        }

        const playbookPath = path.resolve(__dirname, "..", "..", "..", "..", "ansible", "playbook.yml"); // TODO more specific

        const inventoryContent = {
            all: {
                hosts: {
                    [state.name]: {
                        ansible_host: state.host,
                        ansible_user: state.ssh.user,
                        ansible_ssh_private_key_file: state.ssh.privateKeyPath
                    },
                },
            },
        };
    
        console.info("Inventory:")
        console.info(JSON.stringify(inventoryContent))
        console.info("---")

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-'));
        const inventoryPath = path.join(tmpDir, 'inventory.yml');

        fs.writeFileSync(inventoryPath, yaml.dump(inventoryContent), 'utf8');

        this.sm.update({
            status: {
                configuration: {
                    configured: true,
                    lastUpdate: Date.now()
                }
            }
        })

        const ansibleProcess = spawnSync('ansible-playbook', ['-i', inventoryPath, playbookPath], { stdio: 'inherit', shell: true });

        console.debug(`Ansible finished with status: ${ansibleProcess.status}`)

        if (ansibleProcess.status != 0) {
            throw new Error(`Ansible run failed, exit code ${ansibleProcess.status}`)
        }

    }
}