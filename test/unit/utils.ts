import { CommonInstanceInput, InstanceStateV1 } from "../../src/core/state/state";
import path from "path"
import fs, { mkdtempSync } from "fs"
import yaml from 'js-yaml'
import { AwsPulumiOutput } from "../../src/tools/pulumi/aws";
import { AzurePulumiOutput } from "../../src/tools/pulumi/azure";
import { GcpPulumiOutput } from "../../src/tools/pulumi/gcp";
import { PaperspaceMachine } from "../../src/providers/paperspace/client/client";
import { PUBLIC_IP_TYPE_STATIC } from "../../src/core/const";
import { tmpdir } from "os";
import { AnonymousStateParser } from "../../src/core/state/parser";

export const DEFAULT_COMMON_INPUT: CommonInstanceInput = {
    instanceName: "dummy-instance",
    provision: {
        ssh: {
            privateKeyPath: "./test/resources/ssh-key",
            user: "ubuntu"
        }
    },
    configuration: {}
}

export const DUMMY_SSH_KEY_PATH = path.resolve(__dirname, '..', 'resources', 'ssh-key')

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

export function loadRawState(instanceName: string): unknown {
    const filePath = path.resolve(__dirname, 'core', 'state', 'v1-root-data-dir', 'instances', instanceName, 'state.yml')
    return yaml.load(fs.readFileSync(filePath, 'utf-8'))
}

export function loadAnonymousState(instanceName: string): InstanceStateV1 {
    const rawState = loadRawState(instanceName)
    return new AnonymousStateParser().parse(rawState)
}

export function createTempTestDir(prefix: string){
    return mkdtempSync(path.join(tmpdir(), `.cloudypad-unit-test-${prefix}`))
}