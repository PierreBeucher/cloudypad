import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { getLogger } from '../log/utils';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { GenericInstanceManager, InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { StateParser } from './state/parser';
import { StateWriter } from './state/writer';
import { InstanceStateV1 } from './state/state';
import { StateMigrator } from './state/migrator';
import { AwsInstanceStateV1 } from '../providers/aws/state';
import { AzureInstanceStateV1 } from '../providers/azure/state';
import { GcpInstanceStateV1 } from '../providers/gcp/state';
import { PaperspaceInstanceStateV1 } from '../providers/paperspace/state';
import { InstanceUpdater } from './updater';

export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)

    getAllInstances(): string[] {
        return new StateLoader().listInstances()
    }

    private async loadAndMigrateState(instanceName: string): Promise<InstanceStateV1>{
        await new StateMigrator().ensureInstanceStateV1(instanceName)

        const state = await new StateLoader().loadInstanceStateSafe(instanceName)
        return state
    }

    private parseAwsState(rawState: InstanceStateV1): AwsInstanceStateV1 {
        return new StateParser().parseAwsStateV1(rawState)
    }
    
    private parseAzureState(rawState: InstanceStateV1): AzureInstanceStateV1 {
        return new StateParser().parseAzureStateV1(rawState)
    }
    
    private parseGcpState(rawState: InstanceStateV1): GcpInstanceStateV1 {
        return new StateParser().parseGcpStateV1(rawState)
    }
    
    private parsePaperspaceState(rawState: InstanceStateV1): PaperspaceInstanceStateV1 {
        return new StateParser().parsePaperspaceStateV1(rawState)
    }
    
    async buildInstanceManager(name: string): Promise<InstanceManager>{
        const state = await this.loadAndMigrateState(name)

        if (state.provision.provider === CLOUDYPAD_PROVIDER_AWS) {
            return new GenericInstanceManager({
                stateWriter: new StateWriter({ state: this.parseAwsState(state)}),
                factory: new AwsSubManagerFactory()
            })
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_GCP) {
            return new GenericInstanceManager({
                stateWriter: new StateWriter({ state: this.parseGcpState(state)}),
                factory: new GcpSubManagerFactory()
            })
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_AZURE) {
            return new GenericInstanceManager({
                stateWriter: new StateWriter({ state: this.parseAzureState(state)}),
                factory: new AzureSubManagerFactory()
            })
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_PAPERSPACE) {
            return new GenericInstanceManager({
                stateWriter: new StateWriter({ state: this.parsePaperspaceState(state)}),
                factory: new PaperspaceSubManagerFactory()
            })
        } else {
            throw new Error(`Unknown provider '${state.provision.provider}' in state: ${JSON.stringify(state)}`)
        }
    }

    async buildAwsInstanceUpdater(instanceName: string): Promise<InstanceUpdater<AwsInstanceStateV1>> {
        const rawState = await this.loadAndMigrateState(instanceName)
        const stateWriter = new StateWriter({ state: this.parseAwsState(rawState) })
        return new InstanceUpdater({ stateWriter: stateWriter })
    }
    
    async buildGcpInstanceUpdater(instanceName: string): Promise<InstanceUpdater<GcpInstanceStateV1>> {
        const rawState = await this.loadAndMigrateState(instanceName)
        const stateWriter = new StateWriter({ state: this.parseGcpState(rawState) })
        return new InstanceUpdater({ stateWriter: stateWriter })
    }
    
    async buildAzureInstanceUpdater(instanceName: string): Promise<InstanceUpdater<AzureInstanceStateV1>> {
        const rawState = await this.loadAndMigrateState(instanceName)
        const stateWriter = new StateWriter({ state: this.parseAzureState(rawState) })
        return new InstanceUpdater({ stateWriter: stateWriter })
    }
    
    async buildPaperspaceInstanceUpdater(instanceName: string): Promise<InstanceUpdater<PaperspaceInstanceStateV1>> {
        const rawState = await this.loadAndMigrateState(instanceName)
        const stateWriter = new StateWriter({ state: this.parsePaperspaceState(rawState) })
        return new InstanceUpdater({ stateWriter: stateWriter })
    }
    


}