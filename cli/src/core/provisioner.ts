/**
 * An initializer to provision an instance for a specific Provider
 */
export interface InstanceProvisioner {
    provision(): Promise<void>

    destroy(): Promise<void>
}

