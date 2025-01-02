import { getLogger, Logger } from "../log/utils"
import { CommonProvisionInputV1, CommonProvisionOutputV1 } from "./state/state"
import { confirm } from '@inquirer/prompts'

export interface InstanceProvisionOptions  {
    autoApprove?: boolean
}

export interface DestroyOptions {
    autoApprove?: boolean
}

/**
 * Provision instances: manage Cloud resources and infrastructure
 */
export interface InstanceProvisioner  {

    /**
     * Verify local provider config is valid to run other operations.
     * Throw an exception if config is invalid. 
     */
    verifyConfig(): Promise<void>

    /**
     * Provision the instance: create and update infrastructure and Cloud resources. 
     * @param opts 
     * @returns Outputs after provision
     */
    provision(opts?: InstanceProvisionOptions): Promise<CommonProvisionOutputV1>

    /**
     * Destroy the instance. Every infrastructure and Cloud resources managed for this instance are destroyed. 
     * @param opts 
     */
    destroy(opts?: DestroyOptions): Promise<void>
}

export interface InstanceProvisionerArgs<C extends CommonProvisionInputV1, O extends CommonProvisionOutputV1> {
    instanceName: string
    input: C
    output?: O
}

export abstract class AbstractInstanceProvisioner<C extends CommonProvisionInputV1, O extends CommonProvisionOutputV1> implements InstanceProvisioner {
    
    protected logger: Logger
    protected args: InstanceProvisionerArgs<C, O>

    constructor(args: InstanceProvisionerArgs<C, O>){
        this.logger = getLogger(args.instanceName)
        this.args = args
    }

    async verifyConfig(): Promise<void> {
        this.logger.info(`Verifying configuration for instance ${this.args.instanceName}`);
        await this.doVerifyConfig();
    }

    async provision(opts?: InstanceProvisionOptions): Promise<O> {
        this.logger.info(`Provisioning instance ${this.args.instanceName}`);
        return await this.doProvision(opts);
    }

    async destroy(opts?: DestroyOptions): Promise<void> {
        this.logger.info(`Destroying instance: ${this.args.instanceName}`)

        let autoApprove = opts?.autoApprove
        if(opts?.autoApprove === undefined){
            autoApprove = await confirm({
                message: `You are about to destroy instance '${this.args.instanceName}'. Please confirm:`,
                default: false,
            })
        }

        if (!autoApprove) {
            throw new Error('Destroy aborted.')
        }

        this.logger.info(`Destroying instance ${this.args.instanceName}...`)
        
        await this.doDestroy()

        this.logger.info(`Destroyed instance ${this.args.instanceName}`)
    }

    protected abstract doVerifyConfig(): Promise<void>;
    protected abstract doProvision(opts?: InstanceProvisionOptions): Promise<O>;
    protected abstract doDestroy(): Promise<void>;

}