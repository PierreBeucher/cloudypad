import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { PartialDeep } from "type-fest"
import lodash from 'lodash';
import { CLOUDYPAD_INSTANCES_DIR, CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import path from 'path';
import { AwsInstanceRunner } from '../providers/aws/runner';
import { AwsProvisioner } from '../providers/aws/provisioner';
import { AnsibleConfigurator } from '../configurators/ansible';
import { InstanceProvisioner } from './provisioner';
import { InstanceRunner } from './runner';
import { PaperspaceProvisioner } from '../providers/paperspace/provisioner';
import { PaperspaceInstanceRunner } from '../providers/paperspace/runner';
import { PaperspaceProviderState } from '../providers/paperspace/state';
import { AwsProviderState } from '../providers/aws/state';
import { InstanceManager } from './manager';

/**
 * Current state of a CloudyPadInstance object. 
 * Instance state is loaded from and written to disk from this state. 
 */
export interface InstanceState {
    /**
     * Unique instance name
     */
    name: string,

    /**
     * Provider used by instance. Exactly one is provided.
     */
    provider?: {
        aws?: AwsProviderState
        paperspace?: PaperspaceProviderState
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

export class StateManager {
    
    private state: InstanceState
    
    constructor(state: InstanceState){
        this.state = state
    }

    get(){
        return this.state
    }

    async update(data: PartialDeep<InstanceState>){
        lodash.merge(this.state, data)
        await this.persist()
    }

    /**
     * Write state to disk. 
     * TODO use a lock mechanism to avoid concurrent writes 
     */
    async persist(){
        const confPath = InstanceManager.getInstanceConfigPath(this.state.name)

        // console.debug(`Writing instance ${this.state.name} state to disk at ${confPath}`)

        fs.writeFileSync(confPath, yaml.dump(this.state), 'utf-8')
    }
}