
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { InstanceStateV1 } from '../core/state/state';
import { AbstractInstanceConfigurator, InstanceConfigurator } from '../core/configurator';
import { getLogger, Logger } from '../log/utils';
import { AnsibleClient } from '../tools/ansible';
import { CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY, CLOUDYPAD_VERSION } from '../core/const';
import { SshKeyLoader } from '../tools/ssh';
import { AbstractConfiguratorFactory } from '../core/submanager-factory';


export interface AnsibleConfiguratorArgs<ST extends InstanceStateV1> {
    instanceName: string
    provider: string
    provisionInput: ST["provision"]["input"]
    provisionOutput: NonNullable<ST["provision"]["output"]>
    configurationInput: ST["configuration"]["input"]
    additionalAnsibleArgs?: string[]
}

export class AnsibleConfigurator<ST extends InstanceStateV1> extends AbstractInstanceConfigurator<ST> {

    protected readonly logger: Logger
    protected readonly args: AnsibleConfiguratorArgs<ST>

    constructor(args: AnsibleConfiguratorArgs<ST>){
        super()
        this.args = args
        this.logger = getLogger(args.instanceName)
    }

    async doConfigure(): Promise<NonNullable<ST["configuration"]["output"]>> {

        this.logger.debug(`Running Ansible configuration with input: ${JSON.stringify(this.args.configurationInput)}`)

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

        const inventoryObject = await this.generateInventoryObject()

        this.logger.trace(`Inventory content: ${JSON.stringify(inventoryObject)}`)

        const inventoryPath = await this.writeTempInventory(inventoryObject)

        await this.doRunAnsible(inventoryPath, playbookPath, this.args.additionalAnsibleArgs ?? [])

        return {
            // Running Ansible with data disk will ensure it's configured
            dataDiskConfigured: this.args.provisionOutput.dataDiskId !== undefined,
        }
    }

    protected async doRunAnsible(inventoryPath: string, playbookPath: string, additionalAnsibleArgs: string[]): Promise<void> {
        const ansible = new AnsibleClient()
        await ansible.runAnsible(inventoryPath, playbookPath, additionalAnsibleArgs)
    }

    /**
     * Write JSON Object inventory to a temporary file
     * @param jsonObjectInventory Inventory content as a JSON object
     * @returns Path to the inventory file
     */
    public async writeTempInventory(jsonObjectInventory: any): Promise<string> {
        
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-'));
        const inventoryPath = path.join(tmpDir, 'inventory.yml');

        this.logger.debug(`Writing inventory file at ${inventoryPath}`)

        fs.writeFileSync(inventoryPath, yaml.stringify(jsonObjectInventory), 'utf8')

        return inventoryPath
    }

    /**
     * Generate inventory content for Ansible as a JSON object
     * @returns Inventory content as a JSON object
     */
    public async generateInventoryObject(): Promise<any>   {
        const sshPrivateKeyPath = new SshKeyLoader().getSshPrivateKeyPath(this.args.provisionInput.ssh)

        return {
            all: {
                hosts: {
                    [this.args.instanceName]: {
                        ansible_host: this.args.provisionOutput.host,
                        ansible_user: this.args.provisionInput.ssh.user,
                        ansible_ssh_private_key_file: sshPrivateKeyPath,

                        cloudypad_provider: this.args.provider,

                        wolf_instance_name: this.args.instanceName,
                        
                        // use server name from input if provided, otherwise use instance name
                        sunshine_server_name: this.args.configurationInput.sunshine?.serverName ?? this.args.instanceName,

                        sunshine_web_username: this.args.configurationInput.sunshine?.username,
                        sunshine_web_password_base64: this.args.configurationInput.sunshine?.passwordBase64,
                        sunshine_nvidia_enable: true,
                        sunshine_image_tag: this.args.configurationInput.sunshine?.imageTag ?? CLOUDYPAD_VERSION,
                        sunshine_image_registry: this.args.configurationInput.sunshine?.imageRegistry ?? CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY,

                        sunshine_keyboard_layout: this.args.configurationInput.keyboard?.layout,
                        sunshine_keyboard_variant: this.args.configurationInput.keyboard?.variant,
                        sunshine_keyboard_model: this.args.configurationInput.keyboard?.model,
                        sunshine_keyboard_options: this.args.configurationInput.keyboard?.options,

                        sunshine_locale: this.args.configurationInput.locale,
                        
                        autostop_enable: this.args.configurationInput.autostop?.enable,
                        autostop_timeout_seconds: this.args.configurationInput.autostop?.timeoutSeconds,

                        cloudypad_data_disk_enabled: this.args.provisionOutput.dataDiskId !== undefined,
                        cloudypad_data_disk_id: this.args.provisionOutput.dataDiskId,
                    },
                },
            },
        }
    }
}

export interface AnsibleConfiguratorOptions {
    /**
     * Additional arguments to pass to Ansible, eg. --extra-vars
     */
    additionalAnsibleArgs?: string[]
}

export class AnsibleConfiguratorFactory extends AbstractConfiguratorFactory<InstanceStateV1, AnsibleConfiguratorOptions> {

    async doBuildConfigurator(
        name: string,
        provider: string,
        provisionInput: InstanceStateV1["provision"]["input"],
        provisionOutput: NonNullable<InstanceStateV1["provision"]["output"]>,
        configurationInput: InstanceStateV1["configuration"]["input"],
        configuratorOptions: AnsibleConfiguratorOptions
    ): Promise<InstanceConfigurator> {

        const configurator = new AnsibleConfigurator<InstanceStateV1>({
            instanceName: name,
            provider: provider,
            provisionInput: provisionInput,
            provisionOutput: provisionOutput,
            configurationInput: configurationInput,
            additionalAnsibleArgs: configuratorOptions?.additionalAnsibleArgs
        })

        return configurator
    }
}