import { PaperspaceProviderStateV0 } from '../../providers/paperspace/state'
import { AwsProviderStateV0 } from '../../providers/aws/state'
import { AzureProviderStateV0 } from '../../providers/azure/state'
import { GcpProviderStateV0 } from '../../providers/gcp/state'
import { z } from "zod"
import { CLOUDYPAD_CONFIGURATOR_LIST } from "../const"

const CommonProvisionOutputV1Schema = z.object({
    host: z.string().describe("Instance hostname or IP address. Can be used by Moonlight to pair with instance. Maybe be an IP or a FQDN."),
    publicIPv4: z.string().optional().describe("Instance public IPv4 address if any. IPv4 may change in instance lifecycle, prefer using host unless IP is prefered for specific use cases."),
    dataDiskId: z.string().optional().describe("Unique ID of data disk for infrastructure operations (snapshots, etc.). Format is provider-specific."),
    dataDiskSnapshotId: z.string().optional().describe("Unique ID of data disk snapshot (if any) which can be used to restore data disk"),
    baseImageId: z.string().optional().describe("Unique ID of base image (if any) created from initial deploy, used to restore root disk with configured system on instance creation"),
    machineDataDiskLookupId: z.string().optional().describe("Identifier used to find and mount the data disk on the VM. Format depends on provider (e.g., volume UUID, LUN number, disk name)."),
    machineDataDiskMountMethod: z.string().optional().describe("Method to look up and mount data disk on VM (e.g., 'default', 'azure_lun'). If undefined, uses default method."),
}).passthrough()

const CommonProvisionInputV1Schema = z.object({
    ssh: z.object({
        user: z.string().describe("SSH user"),
        privateKeyPath: z.string().optional().describe("Local path to private key. Exactly one SSH authentication method must be set."),
        privateKeyContentBase64: z.string().optional().describe("Private key content (base64 encoded). Exactly one SSH authentication method must be set."),
        passwordBase64: z.string().optional().describe("Password (base64 encoded). Exactly one SSH authentication method must be set."),
    }).describe("SSH access configuration")
    .passthrough()
    .refine((data) => {
        // to check a single auth method is set, increment counter and check exactly one is set
        let setAuthMethods = 0
        if(data.privateKeyPath) setAuthMethods++
        if(data.privateKeyContentBase64) setAuthMethods++
        if(data.passwordBase64) setAuthMethods++
        return setAuthMethods === 1
    }, {
        message: "Exactly one of privateKeyPath, privateKeyContentBase64 or passwordBase64 must be set"
    }),
    dataDiskSnapshot: z.object({
        enable: z.boolean().describe("Whether to enable data disk snapshot on stop. Default: false"),
    }).optional().describe("Data disk snapshot configuration for cost reduction"),
    baseImageSnapshot: z.object({
        enable: z.boolean().describe("Whether to enable base image snapshot after initial deploy. Default: false"),
        keepOnDeletion: z.boolean().optional().describe("Whether to keep base image on instance deletion. Default: false"),
    }).optional().describe("Base image snapshot configuration to capture configured system (NVIDIA drivers, Cloudy Pad, etc.)"),
    deleteInstanceServerOnStop: z.boolean().describe("Whether instance server should be deleted on instance stop and re-created on next start").optional(),
    imageId: z.string().optional().describe("Existing image ID for instance server. If set, disk size must be equal or greater than image size. Format is provider-specific (e.g., AMI ID for AWS, image ID for GCP, etc.)."),
    
    // Runtime state (updated by manager before calling provision to control provisioner behavior)
    // These represent the desired state of resources and are updated on start/stop operations
    // Clearly separated from user-defined config to avoid confusion
    runtime: z.object({
        instanceServerState: z.enum(["present", "absent"]).optional().describe("Desired instance server state. present: instance server should exist; absent: should be deleted"),
        dataDiskState: z.enum(["live", "snapshot"]).optional().describe("Desired data disk state. live: disk exists, created from existing snapshot if possible. snapshot: snapshot exists, created from existing disk if possible (disk is deleted after snapshot created). Default: live"),
    }).optional().describe("Runtime state flags updated by manager on start/stop operations"),
}).passthrough()

const CommonConfigurationInputV1Schema = z.object({
    autostop: z.object({
        enable: z.boolean().describe("Whether Auto Stop is enabled"),
        timeoutSeconds: z.number().describe("Auto Stop timeout in seconds").optional(),
    }).optional(),
    ratelimit: z.object({
        maxMbps: z.number().describe("Maximum rate limit in Mbps. 0 to disable rate limiting.").optional(),
    }).optional().describe("Rate limit egress bandwidth (eg. to limit egress cost with some providers)"),
    // Set both sunshine and wolf nullish as enabling one should enforce disabling the other.
    // As optional (~= undefined) could cause a race condition where both are enabled
    // (eg. merging a state with Sunshine enabled but "undefined" in memory would keep it enabled
    // whereas a null value would force value to become "null" in state)
    sunshine: z.object({
        enable: z.boolean().describe("Whether Sunshine is enabled"),
        passwordBase64: z.string().describe("Sunshine web UI password (base64 encoded)"),
        username: z.string().describe("Sunshine web UI username"),
        imageTag: z.string().optional().describe("Sunshine container image tag. Default to current Cloudy Pad version"),
        imageRegistry: z.string().optional().describe("Sunshine container image registry. Default to Cloudy Pad registry"),
        serverName: z.string().optional().describe("Sunshine server name that will appear in Moonlight. Default to instance name."),
        maxBitrateKbps: z.number().optional().describe("Maximum bitrate in Kbps for Sunshine streaming. Passed as Sunshine config max_bitrate. Default: 0"),
        autoheal: z.object({
            enable: z.boolean().optional().describe("Whether to enable Sunshine container autoheal. Default: true"),
        }).optional(),
    })
    .nullish(),
    keyboard: z.object({
        layout: z.string().describe("Keyboard layout").optional(),
        model: z.string().describe("Keyboard model").optional(),
        variant: z.string().describe("Keyboard variant").optional(),
        options: z.string().describe("Keyboard options").optional(),
    }).nullish(),
    locale: z.string().describe("Desired locale, eg. fr_FR.UTF-8").nullish(),
    wolf: z.object({
        enable: z.boolean().describe("Whether Wolf is enabled"),
    }).nullish(),
    ansible: z.object({
        additionalArgs: z.string().describe("Additional Ansible playbook command arguments, eg. '--tags data-disk -vvv'").optional(),
    }).optional(),
})
.passthrough()
// Only one of Sunshine or Wolf can be enabled at the same time
.refine((data) => !(data.sunshine?.enable && data.wolf?.enable), {
    message: "Sunshine and Wolf cannot be enabled both at the same time",
})
.transform((data) => {
    // If neither Sunshine nor Wolf enabled, enable Wolf
    if(!data.sunshine?.enable && !data.wolf?.enable){
        data.wolf = { enable: true }
        data.sunshine = null
    }
    return data
})

const CommonConfigurationOutputV1Schema = z.object({
    dataDiskConfigured: z.boolean().default(false).describe("Whether data disk has been configured."),
}).passthrough()

const StateMetadataSchema = z.object({
    lastConfigurationDate: z.number().describe("Last successful configuration date (Linux timestamp)").optional(),
    lastConfigurationCloudypadVersion: z.string().describe("Cloudy Pad version used for the last successful configuration").optional(),
    lastProvisionDate: z.number().describe("Last successful provision date (Linux timestamp)").optional(),
    lastProvisionCloudypadVersion: z.string().describe("Cloudy Pad version used for the last successful provision").optional(),
})

export enum InstanceEventEnum {
    Init = "init",
    
    ProvisionBegin = "provision-begin",
    ProvisionEnd = "provision-end",
    
    ConfigurationBegin = "configuration-begin",
    ConfigurationEnd = "configuration-end",
    
    StartBegin = "start-begin",
    StartEnd = "start-end",
    
    StopBegin = "stop-begin",
    StopEnd = "stop-end",

    RestartBegin = "restart-begin",
    RestartEnd = "restart-end",
    
    DestroyBegin = "destroy-begin",
    DestroyEnd = "destroy-end",
}

const InstanceEventSchema = z.object({
    type: z.enum([
        InstanceEventEnum.Init,
        InstanceEventEnum.ProvisionBegin,
        InstanceEventEnum.ProvisionEnd,
        InstanceEventEnum.ConfigurationBegin,
        InstanceEventEnum.ConfigurationEnd,
        InstanceEventEnum.StartBegin,
        InstanceEventEnum.StartEnd,
        InstanceEventEnum.StopBegin,
        InstanceEventEnum.StopEnd,
        InstanceEventEnum.DestroyBegin,
        InstanceEventEnum.DestroyEnd,
        InstanceEventEnum.RestartBegin,
        InstanceEventEnum.RestartEnd,
    ]).describe("Event type"),
    timestamp: z.number().describe("Event date (Linux timestamp)"),
})

/**
 * Maximum number of events in instance state. Oldest events are removed when this limit is reached.
 */
export const STATE_MAX_EVENTS = 10

const InstanceStateV1Schema = z.object({
    version: z.literal("1").describe("State schema version, always 1"),
    name: z.string().describe("Unique instance name"),
    events: z.array(InstanceEventSchema).optional().describe(`List of recent instance events causing a state mutation or infrastructure change (up to ${STATE_MAX_EVENTS} events)`),
    provision: z.object({
        provider: z.string().describe("Provider name"), // Any provider name is supported in schema
        output: CommonProvisionOutputV1Schema.optional(),
        input: CommonProvisionInputV1Schema,
    }),
    configuration: z.object({
        configurator: z.enum(CLOUDYPAD_CONFIGURATOR_LIST).describe("Supported configurators"),
        output: CommonConfigurationOutputV1Schema.optional(),
        input: CommonConfigurationInputV1Schema,
    }),
    metadata: StateMetadataSchema.optional(),
})

const CostAlertSchema = z.object({
    limit: z.number().describe("Cost alert limit"),
    notificationEmail: z.string().describe("Cost alert notification email"),
}).nullish().describe("Cost alert configuration")

export { InstanceStateV1Schema, 
    CommonProvisionOutputV1Schema, 
    CommonProvisionInputV1Schema, 
    CostAlertSchema, 
    CommonConfigurationInputV1Schema, 
    CommonConfigurationOutputV1Schema 
}

/**
 * State representation of Cloudy Pad instance.
 * These data are persisted on disk and loaded in memory,
 * used to manipulate instance for any action.
 */
export type InstanceStateV1 = z.infer<typeof InstanceStateV1Schema>

export type CommonProvisionInputV1 = z.infer<typeof CommonProvisionInputV1Schema>
export type CommonProvisionOutputV1 = z.infer<typeof CommonProvisionOutputV1Schema>

export type CommonConfigurationInputV1 = z.infer<typeof CommonConfigurationInputV1Schema>
export type CommonConfigurationOutputV1 = z.infer<typeof CommonConfigurationOutputV1Schema>

export type StateMetadata = z.infer<typeof StateMetadataSchema>

export type InstanceEvent = z.infer<typeof InstanceEventSchema>

/**
 * Wrapper around all possible Inputs for an instance
 */
export interface CommonInstanceInput {
    instanceName: string,
    provision: CommonProvisionInputV1,
    configuration: CommonConfigurationInputV1
}

export interface InstanceInputs<
    P extends CommonProvisionInputV1, 
    C extends CommonConfigurationInputV1 = CommonConfigurationInputV1
> extends CommonInstanceInput {
    instanceName: string,
    provision: P,
    configuration: C
}

/**
 * Legacy state of a Cloudy Pad instance. It contains every data
 * about an instance: Cloud provider used, how to access, etc.
 * 
 * These data are persisted on disk and loaded in memory. This class
 * thus represent the interface between filesystem and running program data.
 */
export interface InstanceStateV0 {
    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one is provided.
     */
    provider?: {
        aws?: AwsProviderStateV0
        paperspace?: PaperspaceProviderStateV0
        azure?: AzureProviderStateV0
        gcp?: GcpProviderStateV0
    },

    /**
     * Known public hostname or IP address
     */
    host?: string,

    /**
     * SSH configuration to reach instance
     */
    ssh?: {
        user?: string,
        privateKeyPath?: string,
    }

    /**
     * Current instance status
     */
    status: {
        /**
         * Instance initialization status. An instance is initialize if it's gone through 
         * a full provisioning + configuration process at least once. 
         */
        initalized: boolean

        /**
         * Provisioning status. Provisioning is the act of deploying Cloud resources.
         */
        provision: {

            /**
             * Whether instance has been provisioned at least once
             */
            provisioned: boolean

            /**
             * Last provision date (Linux timestamp)
             */
            lastUpdate?: number
        }

        /**
         * Configuration status. Configuring is the act of csetting up instance OS configuration: drivers, gaming servers, etc.
         */
        configuration: {

            /**
             * Whether instance has been configured at least once
             */
            configured: boolean

            /**
             * Last configuration date (Linux timestamp)
             */
            lastUpdate?: number
        }
    }
}