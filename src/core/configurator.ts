/**
 * Configurator are responsible to configure an instance after provisioning,
 * such as installing drivers and system packages.
 */
export interface InstanceConfigurator {
    configure(): Promise<void>
}
