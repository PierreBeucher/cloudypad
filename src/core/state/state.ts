import { PaperspaceInstanceStateV1, PaperspaceProviderStateV0 } from '../../providers/paperspace/state'
import { AwsInstanceStateV1, AwsProviderStateV0 } from '../../providers/aws/state'
import { CLOUDYPAD_PROVIDER } from '../const'
import { AzureInstanceStateV1, AzureProviderStateV0 } from '../../providers/azure/state'
import { GcpInstanceStateV1, GcpProviderStateV0 } from '../../providers/gcp/state'

export type AnyInstanceStateV1 = AwsInstanceStateV1 | AzureInstanceStateV1 | GcpInstanceStateV1 | PaperspaceInstanceStateV1

/**
 * State representation of Cloudy Pad instance.
 * These data are persisted on disk and loaded in memory,
 * used to manipulate instance for any action.
 */
export interface InstanceStateV1<C extends CommonProvisionConfigV1, O extends CommonProvisionOutputV1> {

    /**
     * This state schema version. Always "1". 
     */
    version: "1",

    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one must be set.
     */
    provision: {
        provider: CLOUDYPAD_PROVIDER,
        // Generic types, may be more complex
        output?: O,
        config: C,
    },
}

// export interface CommonProvisionStateV1 { 
//     config: CommonProvisionConfigV1, 
//     output?: CommonProvisionOutputV1 
// }

export interface CommonProvisionConfigV1 {
    /**
     * SSH access configuration
     */
    ssh: {
        user: string,
        privateKeyPath: string,
    }
}

/**
 * Provision outputs are data representing Cloud resources and infrastructure after provision
 * such as hostname/IP and relevent provider-specific resources (eg. Cloud virtual machine ID)
 */
export interface CommonProvisionOutputV1 {

    /**
     * Known hostname for instance
     */
    host: string,

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