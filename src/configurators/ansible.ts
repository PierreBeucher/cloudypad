
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { CommonConfigurationInputV1, CommonProvisionInputV1, CommonProvisionOutputV1, InstanceStateV1 } from '../core/state/state';
import { AbstractInstanceConfigurator } from '../core/configurator';
import { getLogger, Logger } from '../log/utils';
import { AnsibleClient } from '../tools/ansible';
import { CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY, CLOUDYPAD_VERSION } from '../core/const';

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

        this.logger.debug(`Running Ansible configuration with input: ${JSON.stringify(this.args.configurationInput)}`)

        const ssh = this.args.provisionInput.ssh

        // check input validity: only Sunshine or Wolf can be enabled
        if (this.args.configurationInput.sunshine?.enable && this.args.configurationInput.wolf?.enable) {
            throw new Error("Only one of Sunshine or Wolf can be enabled. Got input: " + JSON.stringify(this.args.configurationInput))
        }

        let playbookPath: string
        if(this.args.configurationInput.sunshine?.enable){
            playbookPath = path.resolve(__dirname, "..", "..", "ansible", "sunshine.yml")
        } else if(this.args.configurationInput.wolf?.enable){
            playbookPath = path.resolve(__dirname, "..", "..", "ansible", "wolf.yml")
        } else {
            throw new Error("No streaming server enabled. Got input: " + JSON.stringify(this.args.configurationInput))
        }

        this.logger.debug(`Using playbook ${playbookPath}`)

        const inventoryContent = {
            all: {
                hosts: {
                    [this.args.instanceName]: {
                        ansible_host: this.args.provisionOutput.host,
                        ansible_user: ssh.user,
                        ansible_ssh_private_key_file: ssh.privateKeyPath,
                        wolf_instance_name: this.args.instanceName,
                        sunshine_server_name: this.args.instanceName,
                        sunshine_web_username: this.args.configurationInput.sunshine?.username,
                        sunshine_web_password_base64: this.args.configurationInput.sunshine?.passwordBase64,
                        sunshine_nvidia_enable: true,
                        sunshine_image_tag: this.args.configurationInput.sunshine?.imageTag ?? CLOUDYPAD_VERSION,
                        sunshine_image_registry: this.args.configurationInput.sunshine?.imageRegistry ?? CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY,
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