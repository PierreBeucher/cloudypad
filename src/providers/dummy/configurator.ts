
import { InstanceStateV1 } from '../../core/state/state';
import { AbstractInstanceConfigurator } from '../../core/configurator';
import { getLogger, Logger } from '../../log/utils';

export interface DummyConfiguratorArgs {
    instanceName: string
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
        this.logger.debug(`Running dummy configuration for instance ${this.args.instanceName}`)
        return {}
    }
}