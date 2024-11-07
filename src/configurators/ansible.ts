
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { StateManager } from '../core/state';
import { InstanceConfigurator } from '../core/configurator';
import { getLogger, Logger } from '../log/utils';
import { AnsibleClient } from '../tools/ansible';

export class AnsibleConfigurator implements InstanceConfigurator {

    private readonly sm: StateManager
    protected readonly logger: Logger
    private readonly additionalAnsibleArgs: string[]

    constructor(sm: StateManager, additionalAnsibleArgs?: string[]){
        this.sm = sm
        this.logger = getLogger(sm.name())
        this.additionalAnsibleArgs = additionalAnsibleArgs ?? []
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

        const ansible = new AnsibleClient()
        await ansible.runAnsible(inventoryPath, playbookPath, this.additionalAnsibleArgs)
    }
}