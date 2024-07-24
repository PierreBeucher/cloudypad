
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { StateManager } from '../core/state';
import { InstanceConfigurator } from '../core/configurator';
import { getLogger, Logger } from '../log/utils';

export class AnsibleConfigurator implements InstanceConfigurator {

    readonly sm: StateManager
    protected readonly logger: Logger

    constructor(sm: StateManager){
        this.sm = sm
        this.logger = getLogger(sm.name())
    }

    async configure() {

        const state = this.sm.get()

        this.logger.debug(`Running Ansible configuration`)

        if(!state.ssh?.user || !state.ssh?.privateKeyPath) {
            throw new Error(`Can't configure instance: SSH user or private key unknwon in state: ${JSON.stringify(state)}`)
        }

        if(!state.host) {
            throw new Error(`Can't configure instance: hostname or public IP unknwon in state: ${JSON.stringify(state)}`)
        }

        // const playbookPath = path.resolve(__dirname,  "..", "..", "..", "ansible", "playbook.yml"); // TODO more specific
        const playbookPath = path.resolve(__dirname, "..", "..", "ansible", "playbook.yml"); // TODO more specific

        this.logger.debug(`Using playbook ${playbookPath}`)

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
        }

        this.logger.debug(`Inventory: ${JSON.stringify(inventoryContent)}`)

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-'));
        const inventoryPath = path.join(tmpDir, 'inventory.yml');

        this.logger.debug(`Writing inventory at: ${inventoryPath}`)

        fs.writeFileSync(inventoryPath, yaml.dump(inventoryContent), 'utf8');

        this.sm.update({
            status: {
                configuration: {
                    configured: true,
                    lastUpdate: Date.now()
                }
            }
        })

        const ansibleCommand = 'ansible-playbook'
        const ansibleArgs = ['-i', inventoryPath, playbookPath]
        this.logger.debug(`Ansible command: ${playbookPath} ${JSON.stringify(ansibleArgs)}`)

        const ansibleProcess = spawnSync(ansibleCommand, ansibleArgs, { stdio: 'inherit', shell: true });

        this.logger.debug(`Ansible finished with status: ${ansibleProcess.status}`)

        if (ansibleProcess.status != 0) {
            
            this.logger.error(`Ansible run failure: ${JSON.stringify(ansibleProcess)}`)

            throw new Error(`Ansible run failed, exit code ${ansibleProcess.status}`)
        }

        this.logger.trace(`Ansible finished: ${JSON.stringify(ansibleProcess)}`)

    }
}