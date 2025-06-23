import * as yaml from 'yaml'
import { S3ClientConfig } from '@aws-sdk/client-s3'
import { StateSideEffect } from './abstract'
import { InstanceStateV1 } from '../state'
import { S3ClientWrapper } from '../../../tools/s3'

export interface S3StateSideEffectArgs {
    bucketName: string
    s3ClientConfig?: S3ClientConfig
}

export const S3_STATE_SIDE_EFFECT_NAME = "s3"

/**
 * S3 backed state side effect. States are saved at bucket under
 * instances/<instance-name>/state.yml
 */
export class S3StateSideEffect extends StateSideEffect {
    
    private s3: S3ClientWrapper
    private args: S3StateSideEffectArgs

    constructor(args: S3StateSideEffectArgs) {
        super(S3_STATE_SIDE_EFFECT_NAME)
        this.s3 = new S3ClientWrapper(args.s3ClientConfig)
        this.args = args
    }

    private getInstanceStateKey(instanceName: string): string {
        return `instances/${instanceName}/state.yml`
    }

    protected async doPersistState<ST extends InstanceStateV1>(state: ST): Promise<void> {

        this.logger.debug(`Persisting ${state.name} to S3 bucket ${this.args.bucketName}`)
        
        const params = {
            Bucket: this.args.bucketName,
            Key: this.getInstanceStateKey(state.name),
            Body: yaml.stringify(state),
        }
        await this.s3.putObject(params)

        this.logger.debug(`Persisted ${state.name} to S3 bucket ${this.args.bucketName}`)
    }

    public async listInstances(): Promise<string[]> {

        const result = await this.s3.listDirectories({ bucket: this.args.bucketName, dir: `instances` })

        this.logger.debug(`Listing instances in ${this.args.bucketName} got result: ${JSON.stringify(result)}`)
        
        return result
    }

    public async instanceExists(instanceName: string): Promise<boolean> {
        const params = {
            Bucket: this.args.bucketName,
            Key: `instances/${instanceName}/state.yml`
        }
        return await this.s3.exists(params)
    }

    public async loadRawInstanceState(instanceName: string): Promise<unknown> {

        this.logger.debug(`Loading state for ${instanceName} from S3 bucket ${this.args.bucketName}`)

        const params = {
            Bucket: this.args.bucketName,
            Key: this.getInstanceStateKey(instanceName)
        }

        const data = await this.s3.getObject(params)

        this.logger.debug(`Loaded state for ${instanceName} from S3 bucket ${this.args.bucketName}`)

        if(!data.Body) {
            throw new Error(`No body found for ${instanceName}`)
        }
        const bodyContents = await data.Body.transformToString("utf-8")
        return yaml.parse(bodyContents)
    }

    public async destroyState(instanceName: string): Promise<void> {
        this.logger.debug(`Destroying S3 State for ${instanceName}`)
        const params = {
            Bucket: this.args.bucketName,
            Key: this.getInstanceStateKey(instanceName)
        }
        await this.s3.deleteObject(params)
        this.logger.debug(`S3 State destroyed for ${instanceName}`)
    }

    public getS3ClientConfig(): S3ClientConfig | undefined {
        return this.args.s3ClientConfig
    }
}
