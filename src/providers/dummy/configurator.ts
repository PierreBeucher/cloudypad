import { CommonConfigurationInputV1, InstanceStateV1 } from '../../core/state/state';
import { AbstractInstanceConfigurator } from '../../core/configurator';
import { getLogger, Logger } from '../../log/utils';
import { DummyProvisionInputV1, DummyProvisionOutputV1 } from './state';

export interface DummyConfiguratorArgs {
    instanceName: string
    provisionInput: DummyProvisionInputV1
    provisionOutput: DummyProvisionOutputV1
    configurationInput: CommonConfigurationInputV1
}

export class DummyConfigurator<ST extends InstanceStateV1> extends AbstractInstanceConfigurator<ST> {

    protected readonly logger: Logger
    private args: DummyConfiguratorArgs

    constructor(args: DummyConfiguratorArgs){
        super()
        this.logger = getLogger(args.instanceName)
        this.args = args
    }

    async doConfigure() {
        this.logger.debug(`Running dummy configuration for instance ${this.args.instanceName} with delay ${this.args.provisionInput.configurationDelaySeconds} seconds`)

        if(this.args.provisionInput.configurationDelaySeconds && this.args.provisionInput.configurationDelaySeconds > 0){
            const delay = this.args.provisionInput.configurationDelaySeconds * 1000
            this.logger.debug(`Emulating configuration delay of Dummy instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        this.logger.debug(`Dummy configuration for instance ${this.args.instanceName} completed`)

        return {
            configuredAt: Date.now(),
            dataDiskConfigured: false,
        }
    }
}