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
import { StateParser } from './state/parser';

export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)
    
    private readonly stateManager: StateManager

    private readonly stateParser = new StateParser()

    constructor() {
        this.stateManager = StateManager.default()
    }

    getAllInstances(): string[] {
        return StateManager.default().listInstances()
    }

    /**
     * Build an InstanceManager for a instance. Load instance state from disk 
     * and create a related InstanceManager.
     */
    async buildManagerForInstance(name: string): Promise<InstanceManager>{
        const state = await StateManager.default().loadInstanceStateSafe(name)
        return this.buildManagerForState(state)
    }

    buildManagerForState(state: InstanceStateV1) {
        if (state.provision.provider === CLOUDYPAD_PROVIDER_AWS) {
            const awsState: AwsInstanceStateV1 = this.stateParser.parseAwsStateV1(state)
            return this.buildAwsInstanceManager(awsState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_GCP) {
            const gcpState: GcpInstanceStateV1 = this.stateParser.parseGcpStateV1(state)
            return this.buildGcpInstanceManager(gcpState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_AZURE) {
            const azureState: AzureInstanceStateV1 = this.stateParser.parseAzureStateV1(state)
            return this.buildAzureInstanceManager(azureState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            const paperspaceState: PaperspaceInstanceStateV1 = this.stateParser.parsePaperspaceStateV1(state)
            return this.buildPaperspaceInstanceManager(paperspaceState)
        } else {
            throw new Error(`Unknown provider '${state.provision.provider}' in state: ${JSON.stringify(state)}`)
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