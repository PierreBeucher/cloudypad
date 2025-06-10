
import { AnsibleConfigurator, AnsibleConfiguratorArgs } from '../../configurators/ansible';
import { DummyInstanceStateV1 } from './state';

export interface DummyConfiguratorArgs extends AnsibleConfiguratorArgs<DummyInstanceStateV1> {}

export class DummyConfigurator extends AnsibleConfigurator<DummyInstanceStateV1> {

    constructor(args: DummyConfiguratorArgs){
        super(args)
    }

    async doConfigure(): Promise<NonNullable<DummyInstanceStateV1['configuration']['output']>> {
        this.logger.debug(`Running dummy configurator for instance: ${this.args.instanceName}`)

        await super.doConfigure()

        return {
            configuredAt: Date.now(),
            dataDiskConfigured: false,
        }
    }

    protected async doRunAnsible(inventoryPath: string, playbookPath: string, additionalAnsibleArgs: string[]): Promise<void> {
        this.logger.debug(`Running dummy Ansible: inventoryPath=${inventoryPath}, playbookPath=${playbookPath}, additionalAnsibleArgs=${JSON.stringify(additionalAnsibleArgs)}`)
    }
}