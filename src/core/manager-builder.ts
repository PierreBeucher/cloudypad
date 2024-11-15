import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { getLogger } from '../log/utils';
import { StateUtils } from './state';
import { AwsInstanceStateV1 } from '../providers/aws/state';
import { AwsInstanceManager } from '../providers/aws/manager';
import { InstanceManager } from './manager';
import { GcpInstanceManager } from '../providers/gcp/manager';
import { AzureInstanceManager } from '../providers/azure/manager';
import { PaperspaceInstanceManager } from '../providers/paperspace/manager';
import { GcpInstanceStateV1 } from '../providers/gcp/state';
import { AzureInstanceStateV1 } from '../providers/azure/state';
import { PaperspaceInstanceStateV1 } from '../providers/paperspace/state';

/**
 * Utility class to manage instances globally. Instance state
 * are saved under CLOUDYPAD_INSTANCES_DIR, this class function
 * allow to manipulate the content of this directory. 
 */
export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)

    private constructor() {}

    static getAllInstances(): string[] {
        return StateUtils.listInstances()
    }

    /**
     * Build an InstanceManager for a instance. Load instance state from disk 
     * and create a related InstanceManager.
     * TODO Zod here
     * @param name 
     */
    static async buildManagerForInstance(name: string): Promise<InstanceManager>{
        const stateRaw = await StateUtils.loadInstanceState(name)

        if (stateRaw.provision.provider === CLOUDYPAD_PROVIDER_AWS) {
            const awsState = stateRaw as AwsInstanceStateV1;
            return new AwsInstanceManager(awsState);
        } else if (stateRaw.provision.provider === CLOUDYPAD_PROVIDER_GCP) {
            const gcpState = stateRaw as GcpInstanceStateV1;
            return new GcpInstanceManager(gcpState);
        } else if (stateRaw.provision.provider === CLOUDYPAD_PROVIDER_AZURE) {
            const azureState = stateRaw as AzureInstanceStateV1;
            return new AzureInstanceManager(azureState);
        } else if (stateRaw.provision.provider === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            const paperspaceState = stateRaw as PaperspaceInstanceStateV1;
            return new PaperspaceInstanceManager(paperspaceState);
        } else {
            throw new Error(`Unknown provider in state: '${stateRaw.provision.provider}'`);
        }
        
    }

}