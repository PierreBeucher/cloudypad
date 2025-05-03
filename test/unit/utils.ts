import { CommonInstanceInput, InstanceStateV1 } from "../../src/core/state/state";
import path from "path"
import fs, { mkdtempSync } from "fs"
import yaml from 'js-yaml'
import { AwsPulumiOutput } from "../../src/providers/aws/pulumi";
import { AzurePulumiOutput } from "../../src/providers/azure/pulumi";
import { GcpPulumiOutput } from "../../src/providers/gcp/pulumi";
import { PaperspaceMachine } from "../../src/providers/paperspace/client/client";
import { PUBLIC_IP_TYPE_STATIC } from "../../src/core/const";
import { tmpdir } from "os";
import { AnonymousStateParser } from "../../src/core/state/parser";
import { STREAMING_SERVER_SUNSHINE } from '../../src/cli/prompter';
import { CreateCliArgs } from "../../src/cli/command";
import { ScalewayPulumiOutput } from "../../src/providers/scaleway/pulumi";
import { CloudypadClient } from "../../src";
/**
 * CommonInstanceInput with as most fields filled as possible while keeping it valid:
 * - privateKeyPath is set but not privateKeyContent
 * - Use Sunshine streaming server, wolf is unset
 */
export const DEFAULT_COMMON_INPUT: CommonInstanceInput = {
    instanceName: "dummy-instance",
    provision: {
        ssh: {
            privateKeyPath: "./test/resources/ssh-key",
            user: "ubuntu"
        }
    },
    configuration: {
        sunshine: {
            enable: true,
            username: "sunshine",
            passwordBase64: "c3Vuc2hpbmVQYXNzd29yZA==", // 'sunshinePassword' in base64,
            imageTag: "local",
            imageRegistry: "dummy.registry.example.co",
        },
        wolf: undefined,
        autostop: {
            enable: true,
            timeoutSeconds: 42
        },
        locale: "fr_FR.UTF-8",
        keyboard: {
            layout: "fr",
            variant: "azerty",
            model: "pc105",
            options: "ctrl:swap_lalt_lctl"
        }
    },
}

export const DEFAULT_COMMON_CLI_ARGS: CreateCliArgs = {
    name: DEFAULT_COMMON_INPUT.instanceName,
    privateSshKey: DEFAULT_COMMON_INPUT.provision.ssh.privateKeyPath,
    yes: true,
    overwriteExisting: false,
    skipPairing: true,
    streamingServer: STREAMING_SERVER_SUNSHINE,
    sunshineUser: DEFAULT_COMMON_INPUT.configuration.sunshine?.username,
    sunshinePassword: DEFAULT_COMMON_INPUT.configuration.sunshine?.passwordBase64 ? Buffer.from(DEFAULT_COMMON_INPUT.configuration.sunshine.passwordBase64, 'base64').toString('utf-8') : undefined,
    sunshineImageTag: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageTag,
    sunshineImageRegistry: DEFAULT_COMMON_INPUT.configuration.sunshine?.imageRegistry,
    autostop: DEFAULT_COMMON_INPUT.configuration.autostop?.enable,
    autostopTimeout: DEFAULT_COMMON_INPUT.configuration.autostop?.timeoutSeconds,
    useLocale: DEFAULT_COMMON_INPUT.configuration.locale,
    keyboardLayout: DEFAULT_COMMON_INPUT.configuration.keyboard?.layout,
    keyboardVariant: DEFAULT_COMMON_INPUT.configuration.keyboard?.variant,
    keyboardModel: DEFAULT_COMMON_INPUT.configuration.keyboard?.model,
    keyboardOptions: DEFAULT_COMMON_INPUT.configuration.keyboard?.options,
}

export const DUMMY_SSH_KEY_PATH = path.resolve(__dirname, '..', 'resources', 'ssh-key')

export const DUMMY_SSH_PUBLIC_KEY_PATH = path.resolve(__dirname, '..', 'resources', 'ssh-key.pub')

/**
 * Dummy output returned by Pulumi during unit test for AWS
 */
export const DUMMY_AWS_PULUMI_OUTPUT: AwsPulumiOutput = { instanceId: "i-0123456789", publicIp: "127.0.0.1" }

/**
 * Dummy output returned by Pulumi during unit test for Azure
 */
export const DUMMY_AZURE_PULUMI_OUTPUT: AzurePulumiOutput = { vmName: "dummy-az", publicIp: "127.0.0.1", resourceGroupName: "dummy-rg"}

/**
 * Dummy output returned by Pulumi during unit test for GCP
 */
export const DUMMY_GCP_PULUMI_OUTPUT: GcpPulumiOutput = { instanceName: "dummy-gcp", publicIp: "127.0.0.1"}

/**
 * Dummy output returned by Pulumi during unit test for Scaleway
 */
export const DUMMY_SCALEWAY_PULUMI_OUTPUT: ScalewayPulumiOutput = { instanceName: "dummy-scw", publicIp: "127.0.0.1", instanceServerId: "server-123456789"}

export const DUMMY_V1_ROOT_DATA_DIR = path.resolve(__dirname, "..", "resources", "states", "v1-root-data-dir")

/**
 * Dummy output returned by Paperspace client during unit test
 */
export const DUMMY_PAPERSPACE_MACHINE: PaperspaceMachine = {
    id: "machine-123456788",
    name: "test-machine",
    state: "running",
    machineType: "RTX4000",
    privateIp: "192.168.0.10",
    publicIp: "127.0.0.1",
    publicIpType: PUBLIC_IP_TYPE_STATIC
}

export function loadRawDummyStateV1(instanceName: string): unknown {
    const filePath = path.resolve(DUMMY_V1_ROOT_DATA_DIR, 'instances', instanceName, 'state.yml')
    return yaml.load(fs.readFileSync(filePath, 'utf-8'))
}

export function loadDumyAnonymousStateV1(instanceName: string): InstanceStateV1 {
    const rawState = loadRawDummyStateV1(instanceName)
    return new AnonymousStateParser().parse(rawState)
}

export function createTempTestDir(prefix: string){
    return mkdtempSync(path.join(tmpdir(), `.cloudypad-unit-test-${prefix}`))
}

const TEST_DATA_ROOT_DIR = createTempTestDir("data-root")

/**
 * Create a Core client suitable for testing. The instance returned use the
 * a local data backend with a temporary directory which remains the same for all tests
 */
export function getEphemeralCoreClient(): CloudypadClient{
    return new CloudypadClient({
        config: {
            dataBackend: {
                local: {
                    dataRootDir: TEST_DATA_ROOT_DIR
                }
            }
        }
    })
}