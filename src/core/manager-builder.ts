import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { getLogger } from '../log/utils';
import { AwsInstanceStateV1 } from '../providers/aws/state';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { AzureInstanceStateV1 } from '../providers/azure/state';
import { PaperspaceInstanceStateV1 } from '../providers/paperspace/state';
import { GcpInstanceStateV1 } from '../providers/gcp/state';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { GenericInstanceManager, InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { StateParser } from './state/parser';
import { StateWriter } from './state/writer';
import { InstanceStateV1 } from './state/state';
import { StateMigrator } from './state/migrator';

export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)

    getAllInstances(): string[] {
        return new StateLoader().listInstances()
    }

    /**
     * Build an InstanceManager for a instance. Load instance state from disk,
     * check for migration and create a related InstanceManager.
     */
    async buildManagerForInstance(name: string): Promise<InstanceManager>{
        
        // Migrate State to V1 if needed
        const migrator = new StateMigrator()
        await migrator.ensureInstanceStateV1(name)

        // Build manager
        const state = await new StateLoader().loadInstanceStateSafe(name)
        return this.buildManagerForState(state)
    }

    buildManagerForState(state: InstanceStateV1): InstanceManager {
        const stateParser = new StateParser()
        if (state.provision.provider === CLOUDYPAD_PROVIDER_AWS) {
            const awsState: AwsInstanceStateV1 = stateParser.parseAwsStateV1(state)
            return this.buildAwsInstanceManager(awsState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_GCP) {
            const gcpState: GcpInstanceStateV1 = stateParser.parseGcpStateV1(state)
            return this.buildGcpInstanceManager(gcpState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_AZURE) {
            const azureState: AzureInstanceStateV1 = stateParser.parseAzureStateV1(state)
            return this.buildAzureInstanceManager(azureState)
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            const paperspaceState: PaperspaceInstanceStateV1 = stateParser.parsePaperspaceStateV1(state)
            return this.buildPaperspaceInstanceManager(paperspaceState)
        } else {
            throw new Error(`Unknown provider '${state.provision.provider}' in state: ${JSON.stringify(state)}`)
        }        
    }

    buildAwsInstanceManager(state: AwsInstanceStateV1){
        return new GenericInstanceManager({
            stateWriter: new StateWriter<AwsInstanceStateV1>({ state: state}),
            factory: new AwsSubManagerFactory()
        })
    }

    buildGcpInstanceManager(state: GcpInstanceStateV1){
        return new GenericInstanceManager({
            stateWriter: new StateWriter<GcpInstanceStateV1>({ state: state}),
            factory: new GcpSubManagerFactory()
        })
    }

    buildAzureInstanceManager(state: AzureInstanceStateV1){
        return new GenericInstanceManager({
            stateWriter:  new StateWriter<AzureInstanceStateV1>({ state: state}),
            factory: new AzureSubManagerFactory()
        })
    }

    buildPaperspaceInstanceManager(state: PaperspaceInstanceStateV1){
        return new GenericInstanceManager({
            stateWriter:  new StateWriter<PaperspaceInstanceStateV1>({ state: state}),
            factory: new PaperspaceSubManagerFactory()
        })
    }

}