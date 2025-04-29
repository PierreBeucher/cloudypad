import { PaperspaceProviderStateV0 } from '../../providers/paperspace/state'
import { AwsProviderStateV0 } from '../../providers/aws/state'
import { AzureProviderStateV0 } from '../../providers/azure/state'
import { GcpProviderStateV0 } from '../../providers/gcp/state'
import { z } from "zod"
import { CLOUDYPAD_CONFIGURATOR_LIST } from "../const"

const CommonProvisionOutputV1Schema = z.object({
    host: z.string().describe("Instance hostname or IP address"),
    dataDiskId: z.string().describe("Unique ID of data disk (if any) which can be found on instance /dev/disk/by-id/<data-disk-id>").optional(),
}).passthrough()

const CommonProvisionInputV1Schema = z.object({
    ssh: z.object({
        user: z.string().describe("SSH user"),
        privateKeyPath: z.string().optional().describe("Local path to private key. Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
        privateKeyContentBase64: z.string().optional().describe("Private key content (base64 encoded). Either privateKeyPath or privateKeyContentBase64 must be set, not both."),
    }).describe("SSH access configuration")
    .refine((data) => {
        if(data.privateKeyPath && data.privateKeyContentBase64 ||
            !data.privateKeyPath && !data.privateKeyContentBase64
        ){
            return false
        }
        return true
    }, {
        message: "Exactly one of privateKeyPath or privateKeyContentBase64 must be set"
    })
}).passthrough()

const CommonConfigurationInputV1Schema = z.object({
    autostop: z.object({
        enable: z.boolean().describe("Whether Auto Stop is enabled"),
        timeoutSeconds: z.number().describe("Auto Stop timeout in seconds").optional(),
    }).optional(),
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
    })
    .nullish()
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

const InstanceStateV1Schema = z.object({
    version: z.literal("1").describe("State schema version, always 1"),
    name: z.string().describe("Unique instance name"),
    provision: z.object({
        provider: z.string().describe("Provider name"), // Any provider name is supported in schema
        output: CommonProvisionOutputV1Schema.optional(),
        input: CommonProvisionInputV1Schema,
    }),
    configuration: z.object({
        configurator: z.enum(CLOUDYPAD_CONFIGURATOR_LIST).describe("Supported configurators"),
        output: CommonConfigurationOutputV1Schema.optional(),
        input: CommonConfigurationInputV1Schema,
    })
})

const CostAlertSchema = z.object({
    limit: z.number().describe("Cost alert limit"),
    notificationEmail: z.string().describe("Cost alert notification email"),
}).nullish().describe("Cost alert configuration")

export { InstanceStateV1Schema, CommonProvisionOutputV1Schema, CommonProvisionInputV1Schema, CostAlertSchema }

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