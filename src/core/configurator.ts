import { CommonConfigurationOutputV1, InstanceStateV1 } from "./state/state";

/**
 * Configurator are responsible to configure an instance after provisioning,
 * such as installing drivers and system packages.
 */
export interface InstanceConfigurator {
    configure(): Promise<CommonConfigurationOutputV1>
}

export abstract class AbstractInstanceConfigurator<ST extends InstanceStateV1> implements InstanceConfigurator {
    configure(): Promise<NonNullable<ST["configuration"]["output"]>> {
        return this.doConfigure()
    }

    abstract doConfigure(): Promise<NonNullable<ST["configuration"]["output"]>>
}
