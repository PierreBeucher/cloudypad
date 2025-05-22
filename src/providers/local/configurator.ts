import { CommonConfigurationInputV1, InstanceStateV1 } from '../../core/state/state';
import { AbstractInstanceConfigurator } from '../../core/configurator';
import { getLogger, Logger } from '../../log/utils';
import { LocalProvisionInputV1, LocalProvisionOutputV1 } from './state';

export interface LocalConfiguratorArgs {
    instanceName: string
    provisionInput: LocalProvisionInputV1
    provisionOutput: LocalProvisionOutputV1
    configurationInput: CommonConfigurationInputV1
}

export class LocalConfigurator<ST extends InstanceStateV1> extends AbstractInstanceConfigurator<ST> {

    protected readonly logger: Logger
    private args: LocalConfiguratorArgs

    constructor(args: LocalConfiguratorArgs){
        super()
        this.logger = getLogger(args.instanceName)
        this.args = args
    }

    async doConfigure() {
        this.logger.debug(`Running local configuration for instance ${this.args.instanceName} with delay ${this.args.provisionInput.configurationDelaySeconds} seconds`)

        if(this.args.provisionInput.configurationDelaySeconds && this.args.provisionInput.configurationDelaySeconds > 0){
            const delay = this.args.provisionInput.configurationDelaySeconds * 1000
            this.logger.debug(`Emulating configuration delay of Local instance ${this.args.instanceName}: ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }

        this.logger.debug(`Local configuration for instance ${this.args.instanceName} completed`)

        return {
            configuredAt: Date.now(),
            dataDiskConfigured: false,
        }
    }
}