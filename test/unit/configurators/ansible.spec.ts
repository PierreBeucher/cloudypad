import * as assert from 'assert';
import * as yaml from 'yaml';
import * as lodash from 'lodash';
import { AnsibleConfigurator, AnsibleConfiguratorArgs } from "../../../src/configurators/ansible"
import { DEFAULT_COMMON_INPUT } from "../utils"
import { CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY, CLOUDYPAD_VERSION } from '../../../src/core/const';
import { DummyInstanceStateV1 } from '../../../src/providers/dummy/state';

describe('Ansible configurator', function () {

    it('should generate inventory content (with defined inputs)', async function () {
        const configurator = new AnsibleConfigurator({
            instanceName: "test-ansible-configurator-instance",
            provider: "test-ansible-configurator-provider",
            provisionInput: DEFAULT_COMMON_INPUT.provision,
            configurationInput: DEFAULT_COMMON_INPUT.configuration,
            provisionOutput: {
                host: "test-ansible-configurator-host",
                dataDiskId: "test-ansible-configurator-data-disk-id"   
            }
        })

        const inventoryContent = await configurator.generateInventoryObject()

        const expectedInventory = {
            all: {
                hosts: {
                    "test-ansible-configurator-instance": {
                        ansible_host: "test-ansible-configurator-host",
                        ansible_user: DEFAULT_COMMON_INPUT.provision.ssh.user,
                        ansible_password: undefined,
                        ansible_ssh_private_key_file: DEFAULT_COMMON_INPUT.provision.ssh.privateKeyPath,

                        cloudypad_provider: "test-ansible-configurator-provider",

                        wolf_instance_name: "test-ansible-configurator-instance",
                        
                        sunshine_server_name: "test-ansible-configurator-instance",
                        sunshine_web_username: DEFAULT_COMMON_INPUT.configuration.sunshine?.username,
                        sunshine_web_password_base64: DEFAULT_COMMON_INPUT.configuration.sunshine?.passwordBase64,
                        sunshine_nvidia_enable: true,
                        sunshine_image_tag: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageTag,
                        sunshine_image_registry: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageRegistry,

                        sunshine_keyboard_layout: DEFAULT_COMMON_INPUT.configuration.keyboard?.layout,
                        sunshine_keyboard_variant: DEFAULT_COMMON_INPUT.configuration.keyboard?.variant,
                        sunshine_keyboard_model: DEFAULT_COMMON_INPUT.configuration.keyboard?.model,
                        sunshine_keyboard_options: DEFAULT_COMMON_INPUT.configuration.keyboard?.options,

                        sunshine_locale: DEFAULT_COMMON_INPUT.configuration.locale,
                        
                        autostop_enable: DEFAULT_COMMON_INPUT.configuration.autostop?.enable,
                        autostop_timeout_seconds: DEFAULT_COMMON_INPUT.configuration.autostop?.timeoutSeconds,

                        cloudypad_data_disk_enabled: "test-ansible-configurator-data-disk-id" !== undefined,
                        cloudypad_data_disk_id: "test-ansible-configurator-data-disk-id",
                    },
                },
            },
        }

        assert.deepStrictEqual(inventoryContent, expectedInventory)
    })

    it('should generate inventory content (with minimal default inputs)', async function () {
        const configurator = new AnsibleConfigurator({
            instanceName: "test-ansible-configurator-instance-default",
            provider: "test-ansible-configurator-provider-default",
            provisionInput: {
                ssh: {
                    user: "test-ansible-configurator-user-default",
                    privateKeyContentBase64: Buffer.from("test-ansible-configurator-private-key-content-base64-default").toString('base64')
                }
            },
            configurationInput: {},
            provisionOutput: {
                host: "test-ansible-configurator-host-default",
            }
        })

        const inventoryJson = await configurator.generateInventoryObject()

        const expectedInventory = {
            all: {
                hosts: {
                    "test-ansible-configurator-instance-default": {
                        ansible_host: "test-ansible-configurator-host-default",
                        ansible_user: "test-ansible-configurator-user-default",

                        // re-use key from result as it's auto generated
                        // should not be empty (tested below)
                        ansible_ssh_private_key_file: inventoryJson.all?.hosts?.["test-ansible-configurator-instance-default"]?.ansible_ssh_private_key_file,

                        cloudypad_data_disk_enabled: false,
                        cloudypad_provider: "test-ansible-configurator-provider-default",
                        sunshine_image_registry: CLOUDYPAD_SUNSHINE_IMAGE_REGISTRY,
                        sunshine_image_tag: CLOUDYPAD_VERSION,
                        sunshine_nvidia_enable: true,
                        sunshine_server_name: "test-ansible-configurator-instance-default",
                        wolf_instance_name: "test-ansible-configurator-instance-default",
                    },
                },
            },
        }

        assert.ok(inventoryJson.all?.hosts?.["test-ansible-configurator-instance-default"]?.ansible_ssh_private_key_file)
    })

    it('should use Sunshine server name if provided in input)', async function () {
        const instanceName = "test-ansible-configurator-instance-default"
        const testConfig: AnsibleConfiguratorArgs<DummyInstanceStateV1> = {
            instanceName: instanceName,
            provider: "test-ansible-configurator-provider-default",
            configurationInput: {
                sunshine: {
                    enable: true,
                    username: "test-ansible-configurator-username",
                    passwordBase64: "test-ansible-configurator-password-base64",
                }
            },
            provisionInput: DEFAULT_COMMON_INPUT.provision,
            provisionOutput: {
                host: "test-ansible-configurator-host", 
                instanceId: "dummy-instance-id",
                provisionedAt: new Date().getTime(),
                dataDiskId: "dummy-data-disk-id",
            },
        }
        const configurator = new AnsibleConfigurator(testConfig)

        const inventoryJsonWithoutServerName = await configurator.generateInventoryObject()
        assert.strictEqual(
            inventoryJsonWithoutServerName.all?.hosts?.[instanceName]?.sunshine_server_name,
            instanceName
        )

        const serverNameOverride = "server-name-override"
        const testConfigWithServerName: AnsibleConfiguratorArgs<DummyInstanceStateV1> = {
            ...testConfig,
            configurationInput: {
                ...testConfig.configurationInput,
                sunshine: {
                    ...testConfig.configurationInput.sunshine!,
                    serverName: serverNameOverride
                }
            }
        }
        const configuratorWithServerName = new AnsibleConfigurator(testConfigWithServerName)
        const inventoryJsonWithServerName = await configuratorWithServerName.generateInventoryObject()
        assert.strictEqual(
            inventoryJsonWithServerName.all?.hosts?.[instanceName]?.sunshine_server_name,
            serverNameOverride
        )
    })

    // should not fail YAML validation
    it('should handle special characters in Sunshine server name)', async function () {
        const instanceName = "test-ansible-configurator-server-name-with-special-characters"
        const baseTestConfig: AnsibleConfiguratorArgs<DummyInstanceStateV1> = {
            instanceName: instanceName,
            provider: "test-ansible-configurator-provider-default",
            configurationInput: {
                sunshine: {
                    enable: true,
                    username: "test-ansible-configurator-username",
                    passwordBase64: "test-ansible-configurator-password-base64",
                }
            },
            provisionInput: {
                ...DEFAULT_COMMON_INPUT.provision,
                instanceType: "dummy-instance-type-1",
            },
            provisionOutput: {
                host: "test-ansible-configurator-host",
                instanceId: "dummy-instance-id",
                provisionedAt: new Date().getTime(),
                dataDiskId: "dummy-data-disk-id",
            },
        }

        const test1 = lodash.merge(baseTestConfig, {
            configurationInput: {
                sunshine: {
                    serverName: "test:\n|-\n<script>alert('foo')</script>\naa\n"
                }
            }
        })
        const configurator = new AnsibleConfigurator(test1)
        const inventoryJson = await configurator.generateInventoryObject()
        const yamlInventory = yaml.stringify(inventoryJson)
        const yamlResult = yaml.parse(yamlInventory)

        assert.strictEqual(yamlResult.all.hosts[instanceName].sunshine_server_name, "test:\n|-\n<script>alert('foo')</script>\naa\n")

        const test2 = lodash.merge(baseTestConfig, {
            configurationInput: {
                sunshine: {
                    serverName: "`~!@#$%^&*()\\_+{}|\n:\"<>?[]\;',./`-=€£¥§©®±¶•ªº¿½¼¾\\`"
                }
            }
        })

        const configurator2 = new AnsibleConfigurator(test2)
        const inventoryJson2 = await configurator2.generateInventoryObject()
        const yamlInventory2 = yaml.stringify(inventoryJson2)
        const yamlResult2 = yaml.parse(yamlInventory2)
        assert.strictEqual(yamlResult2.all.hosts[instanceName].sunshine_server_name, "`~!@#$%^&*()\\_+{}|\n:\"<>?[]\;',./`-=€£¥§©®±¶•ªº¿½¼¾\\`")
    })
})
