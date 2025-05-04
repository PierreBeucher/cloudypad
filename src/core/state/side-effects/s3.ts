import * as yaml from 'js-yaml'
import { S3ClientConfig } from '@aws-sdk/client-s3'
import { StateSideEffect } from './abstract'
import { InstanceStateV1 } from '../state'
import { S3ClientWrapper } from '../../../tools/s3'
import { SideEffectBuilder } from '../builders'

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
    private bucketName: string

    constructor(args: S3StateSideEffectArgs) {
        super(S3_STATE_SIDE_EFFECT_NAME)
        this.s3 = new S3ClientWrapper(args.s3ClientConfig)
        this.bucketName = args.bucketName
    }

    private getInstanceStateKey(instanceName: string): string {
        return `instances/${instanceName}/state.yml`
    }

    protected async doPersistState<ST extends InstanceStateV1>(state: ST): Promise<void> {

        this.logger.debug(`Persisting ${state.name} to S3 bucket ${this.bucketName}`)
        
        const params = {
            Bucket: this.bucketName,
            Key: this.getInstanceStateKey(state.name),
            Body: yaml.dump(state),
        }
        await this.s3.putObject(params)

        this.logger.debug(`Persisted ${state.name} to S3 bucket ${this.bucketName}`)
    }

    public async listInstances(): Promise<string[]> {

        const result = await this.s3.listDirectories({ bucket: this.bucketName, dir: `instances` })

        this.logger.debug(`Listing instances in ${this.bucketName} got result: ${JSON.stringify(result)}`)
        
        return result
    }

    public async instanceExists(instanceName: string): Promise<boolean> {
        const params = {
            Bucket: this.bucketName,
            Key: `instances/${instanceName}/state.yml`
        }
        return await this.s3.exists(params)
    }

    public async loadRawInstanceState(instanceName: string): Promise<unknown> {

        this.logger.debug(`Loading state for ${instanceName} from S3 bucket ${this.bucketName}`)

        const params = {
            Bucket: this.bucketName,
            Key: this.getInstanceStateKey(instanceName)
        }

        const data = await this.s3.getObject(params)

        this.logger.debug(`Loaded state for ${instanceName} from S3 bucket ${this.bucketName}`)

        if(!data.Body) {
            throw new Error(`No body found for ${instanceName}`)
        }
        const bodyContents = await data.Body.transformToString("utf-8")
        return yaml.load(bodyContents)
    }

    public async destroyState(instanceName: string): Promise<void> {
        this.logger.debug(`Destroying S3 State for ${instanceName}`)
        const params = {
            Bucket: this.bucketName,
            Key: this.getInstanceStateKey(instanceName)
        }
        await this.s3.deleteObject(params)
        this.logger.debug(`S3 State destroyed for ${instanceName}`)
    }
}

export class S3SideEffectBuilder implements SideEffectBuilder {
    public build(): StateSideEffect {
        const bucketName = process.env.CLOUDYPAD_BACKEND_S3_BUCKET
        if(!bucketName) {
            throw new Error("S3 side effect for backend requires CLOUDYPAD_BACKEND_S3_BUCKET environment variable to be set. ")
        }

        return new S3StateSideEffect({ bucketName })
    }
}