import { CLOUDYPAD_PROVIDER_AWS, CLOUDYPAD_PROVIDER_AZURE, CLOUDYPAD_PROVIDER_DUMMY, CLOUDYPAD_PROVIDER_GCP, CLOUDYPAD_PROVIDER_PAPERSPACE } from './const';
import { getLogger } from '../log/utils';
import { AwsSubManagerFactory } from '../providers/aws/factory';
import { GcpSubManagerFactory } from '../providers/gcp/factory';
import { AzureSubManagerFactory } from '../providers/azure/factory';
import { PaperspaceSubManagerFactory } from '../providers/paperspace/factory';
import { GenericInstanceManager, InstanceManager } from './manager';
import { StateLoader } from './state/loader';
import { StateWriter } from './state/writer';
import { InstanceStateV1 } from './state/state';
import { AwsInstanceStateV1, AwsStateParser } from '../providers/aws/state';
import { AzureInstanceStateV1, AzureStateParser } from '../providers/azure/state';
import { GcpInstanceStateV1, GcpStateParser } from '../providers/gcp/state';
import { PaperspaceInstanceStateV1, PaperspaceStateParser } from '../providers/paperspace/state';
import { DummyInstanceStateV1, DummyStateParser } from '../providers/dummy/state';
import { DummySubManagerFactory } from '../providers/dummy/factory';

export class InstanceManagerBuilder {

    private static readonly logger = getLogger(InstanceManagerBuilder.name)

    getAllInstances(): string[] {
        return new StateLoader().listInstances()
    }

    private async loadAnonymousState(instanceName: string): Promise<InstanceStateV1>{
        const state = await new StateLoader().loadAndMigrateInstanceState(instanceName)
        return state
    }

    private parseAwsState(rawState: InstanceStateV1): AwsInstanceStateV1 {
        return new AwsStateParser().parse(rawState)
    }
    
    private parseAzureState(rawState: InstanceStateV1): AzureInstanceStateV1 {
        return new AzureStateParser().parse(rawState)
    }
    
    private parseGcpState(rawState: InstanceStateV1): GcpInstanceStateV1 {
        return new GcpStateParser().parse(rawState)
    }
    
    private parsePaperspaceState(rawState: InstanceStateV1): PaperspaceInstanceStateV1 {
        return new PaperspaceStateParser().parse(rawState)
    }

    private parseDummyState(rawState: InstanceStateV1): DummyInstanceStateV1 {
        return new DummyStateParser().parse(rawState)
    }
    
    async buildInstanceManager(name: string): Promise<InstanceManager>{
        const state = await this.loadAnonymousState(name)

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
        } else if (state.provision.provider === CLOUDYPAD_PROVIDER_DUMMY) {
            return new GenericInstanceManager({
                stateWriter: new StateWriter({ state: this.parseDummyState(state)}),
                factory: new DummySubManagerFactory()
            })
        } else {
            throw new Error(`Unknown provider '${state.provision.provider}' in state: ${JSON.stringify(state)}`)
        }
    }
}