import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { getLogger } from '../log/utils';
import { StateManager } from './state/manager';
import { AwsInstanceStateV1 } from '../providers/aws/state';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { InstanceStateV1 } from './state/state';
import { AzureInstanceStateV1 } from '../providers/azure/state';
import { PaperspaceInstanceStateV1 } from '../providers/paperspace/state';
import { GcpInstanceStateV1 } from '../providers/gcp/state';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { InstanceManager } from './manager';

export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)
    
    private readonly stateManager: StateManager

    constructor() {
        this.stateManager = StateManager.default()
    }

    getAllInstances(): string[] {
        return StateManager.default().listInstances()
    }

    /**
     * Build an InstanceManager for a instance. Load instance state from disk 
     * and create a related InstanceManager.
     * TODO Zod here
     * @param name 
     */
    async buildManagerForInstance(name: string): Promise<InstanceManager>{
        const state = await StateManager.default().loadInstanceState(name)
        return this.buildManagerForState(state)
    }

    // TODO ZOD here
    buildManagerForState(state: InstanceStateV1) {
        if (state.provision.provider === CLOUDYPAD_PROVIDER_AWS) {
            return this.buildAwsInstanceManager(state as AwsInstanceStateV1)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_GCP) {
            return this.buildGcpInstanceManager(state as GcpInstanceStateV1)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_AZURE) {
            return this.buildAzureInstanceManager(state as AzureInstanceStateV1)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            return this.buildPaperspaceInstanceManager(state as PaperspaceInstanceStateV1)
        } else {
            throw new Error(`Unknown provider in state: '${state.provision.provider}'`);
        }
    }

    buildAwsInstanceManager(state: AwsInstanceStateV1){
        return new InstanceManager({
            state: state,
            factory: new AwsSubManagerFactory()
        })
    }

    buildGcpInstanceManager(state: GcpInstanceStateV1){
        return new InstanceManager({
            state: state,
            factory: new GcpSubManagerFactory()
        })
    }

    buildAzureInstanceManager(state: AzureInstanceStateV1){
        return new InstanceManager({
            state: state,
            factory: new AzureSubManagerFactory()
        })
    }

    buildPaperspaceInstanceManager(state: PaperspaceInstanceStateV1){
        return new InstanceManager({
            state: state,
            factory: new PaperspaceSubManagerFactory()
        })
    }

}