
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { CommonConfigurationInputV1, CommonProvisionInputV1, CommonProvisionOutputV1, InstanceStateV1 } from '../core/state/state';
import { AbstractInstanceConfigurator } from '../core/configurator';
import { getLogger, Logger } from '../log/utils';
import { AnsibleClient } from '../tools/ansible';

export interface AnsibleConfiguratorArgs {
    instanceName: string
    provisionInput: CommonProvisionInputV1
    provisionOutput: CommonProvisionOutputV1
    configurationInput: CommonConfigurationInputV1
    additionalAnsibleArgs?: string[]
}

export class AnsibleConfigurator<ST extends InstanceStateV1> extends AbstractInstanceConfigurator<ST> {

    protected readonly logger: Logger
    private readonly args: AnsibleConfiguratorArgs

    constructor(args: AnsibleConfiguratorArgs){
        super()
        this.args = args
        this.logger = getLogger(args.instanceName)
    }

    async doConfigure() {

        const ssh = this.args.provisionInput.ssh

        this.logger.debug(`Running Ansible configuration`)

        const playbookPath = path.resolve(__dirname, "..", "..", "ansible", "playbook.yml"); // TODO more specific

        this.logger.debug(`Using playbook ${playbookPath}`)

        const inventoryContent = {
            all: {
                hosts: {
                    [this.args.instanceName]: {
                        ansible_host: this.args.provisionOutput.host,
                        ansible_user: ssh.user,
                        ansible_ssh_private_key_file: ssh.privateKeyPath,
                        wolf_instance_name: this.args.instanceName
                    },
                },
            },
        }

        this.logger.debug(`Inventory: ${JSON.stringify(inventoryContent)}`)

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-'));
        const inventoryPath = path.join(tmpDir, 'inventory.yml');

        this.logger.debug(`Writing inventory at: ${inventoryPath}`)

        fs.writeFileSync(inventoryPath, yaml.dump(inventoryContent), 'utf8');

        const ansible = new AnsibleClient()
        await ansible.runAnsible(inventoryPath, playbookPath, this.args.additionalAnsibleArgs ?? [])

        return {}
    }
}