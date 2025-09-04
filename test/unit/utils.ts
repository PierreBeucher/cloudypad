import { CommonInstanceInput, InstanceStateV1 } from "../../src/core/state/state";
import path from "path"
import fs, { mkdtempSync } from "fs"
import yaml from 'yaml'
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
import { AwsInstanceStateV1 } from "../../src/providers/aws/state";
import { PartialDeep } from "type-fest";
import * as lodash from "lodash"
import { CoreConfig } from "../../src/core/config/interface";
import { DummyProviderClient } from "../../src/providers/dummy/provider";
import { DummyInstanceStateV1, DummyProvisionInputV1, DummyConfigurationOutputV1 } from "../../src/providers/dummy/state";

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
        ratelimit: {
            maxMbps: 50,
        },
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
        },
        ansible: {
            additionalArgs: "-t dummytag"
        }
    },
}

export const DEFAULT_COMMON_CLI_ARGS: CreateCliArgs = {
    name: DEFAULT_COMMON_INPUT.instanceName,
    sshPrivateKey: DEFAULT_COMMON_INPUT.provision.ssh.privateKeyPath,
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
    ansibleAdditionalArgs: DEFAULT_COMMON_INPUT.configuration.ansible?.additionalArgs,
    ratelimitMaxMbps: DEFAULT_COMMON_INPUT.configuration.ratelimit?.maxMbps,
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
export const DUMMY_SCALEWAY_PULUMI_OUTPUT: ScalewayPulumiOutput = { 
    instanceServerName: "dummy-scw", 
    publicIp: "127.0.0.1", 
    instanceServerId: "server-123456789",
    rootDiskId: "disk-123456789",
    dataDiskId: null,
    instanceServerUrn: "urn:xxx"
}

export const DUMMY_V1_ROOT_DATA_DIR = path.resolve(__dirname, "..", "resources", "states", "v1-root-data-dir")

/**
 * Dummy output returned by Paperspace client during unit test
 */
export const DUMMY_PAPERSPACE_MACHINE: PaperspaceMachine = {
    id: "machine-123456788",
    name: "test-machine",
    state: "ready",
    machineType: "RTX4000",
    privateIp: "192.168.0.10",
    publicIp: "127.0.0.1",
    publicIpType: PUBLIC_IP_TYPE_STATIC
}

export function loadRawDummyStateV1(instanceName: string): unknown {
    const filePath = path.resolve(DUMMY_V1_ROOT_DATA_DIR, 'instances', instanceName, 'state.yml')
    return yaml.parse(fs.readFileSync(filePath, 'utf-8'))
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
export function getUnitTestCoreClient(): CloudypadClient{
    return new CloudypadClient({
        config: getUnitTestCoreConfig()
    })
}

export function getUnitTestCoreConfig(): CoreConfig {
    return {
        stateBackend: {
            local: { dataRootDir: TEST_DATA_ROOT_DIR }
        }
    }
}

export function getUnitTestDummyProviderClient(): DummyProviderClient {
    return new DummyProviderClient({
        config: getUnitTestCoreConfig()
    })
}

/**
 * Create a dummy AWS state that can be used for testing
 * @param instanceName 
 * @returns 
 */
export function createDummyAwsState(override: PartialDeep<AwsInstanceStateV1>): AwsInstanceStateV1 {

    // clone deep to avoid later operation returned state
    // to alter DEFAULT_COMMON_INPUT used in this state
    const awsState: AwsInstanceStateV1 = lodash.cloneDeep({
        version: "1",
        provision: {
            provider: "aws",
            input: {
                ...DEFAULT_COMMON_INPUT.provision,
                diskSize: 100,
                instanceType: "g4dn.xlarge",
                region: "eu-west-1",
                publicIpType: "static",
                useSpot: true,
            }
        },
        name: `dummy-aws-instance-${Date.now()}`,
        configuration: {
            configurator: "ansible",
            input: {
                ...DEFAULT_COMMON_INPUT.configuration,
            },
        }
    })

    return lodash.merge(awsState, override)
}

/**
 * Create a dummy state that can be used for testing
 * @param override 
 * @returns 
 */
export function createDummyState(override?: PartialDeep<DummyInstanceStateV1>): DummyInstanceStateV1 {

    // clone deep to avoid later operation returned state
    // to alter DEFAULT_COMMON_INPUT used in this state
    const dummyState: DummyInstanceStateV1 = lodash.cloneDeep({
        version: "1",
        provision: {
            provider: "dummy",
            input: {
                ...DEFAULT_COMMON_INPUT.provision,
                instanceType: "t2.micro",
                startDelaySeconds: 5,
                stopDelaySeconds: 5,
            }
        },
        name: `dummy-instance-${Date.now()}`,
        configuration: {
            configurator: "ansible",
            input: {
                ...DEFAULT_COMMON_INPUT.configuration,
            },
        }
    });

    return lodash.merge(dummyState, override);
}

export async function initializeDummyInstanceState(instanceName: string): Promise<DummyInstanceStateV1> {
    const dummyState = createDummyState({
        name: instanceName,
    })
    const dummyClient = getUnitTestDummyProviderClient()
    const initializer = dummyClient.getInstanceInitializer()
    await initializer.initializeStateOnly(instanceName,
        dummyState.provision.input,
        dummyState.configuration.input
    )
    return dummyState
}