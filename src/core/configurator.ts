import { CommonConfigurationOutputV1, InstanceStateV1 } from "./state/state";

export interface InstanceConfiguratorOpts {
    /**
     * Number of retries for the configuration. Default: 1 (no retry)
     */
    retries?: number

    /**
     * Delay between retries in seconds. Default: 10 seconds
     */
    retryDelaySeconds?: number
}

/**
 * Configurator are responsible to configure an instance after provisioning,
 * such as installing drivers and system packages.
 */
export interface InstanceConfigurator {
    configure(opts?: InstanceConfiguratorOpts): Promise<CommonConfigurationOutputV1>
}

export abstract class AbstractInstanceConfigurator<ST extends InstanceStateV1> implements InstanceConfigurator {
    async configure(opts?: InstanceConfiguratorOpts): Promise<NonNullable<ST["configuration"]["output"]>> {
        // Debug env var to skip Ansible configuration
        // Not exposed as CLI since it's for debugging purposes only
        // and will likely break instance if enabled 
        const skipConfig = process.env.CLOUDYPAD_SKIP_CONFIGURATION
        if (skipConfig === "true" || skipConfig === "1") {
            console.warn("⚠️  CLOUDYPAD_SKIP_CONFIGURATION is set - skipping configuration")
            return {} as NonNullable<ST["configuration"]["output"]>
        }

        const retries = opts?.retries ?? 1
        const retryDelaySeconds = opts?.retryDelaySeconds ?? 10
        let lastError: Error | undefined

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await this.doConfigure(opts)
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))
                
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelaySeconds * 1000))
                }
            }
        }

        throw lastError!
    }

    abstract doConfigure(opts?: Omit<InstanceConfiguratorOpts, "retries" | "retryDelaySeconds">): Promise<NonNullable<ST["configuration"]["output"]>>
}
