import { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, S3ClientConfig, NotFound } from '@aws-sdk/client-s3'
import { getLogger, Logger } from '../log/utils'

/**
 * Wrapper around the S3Client to provide a more consistent interface and exception handling
 */
export class S3ClientWrapper {
    private s3: S3Client

    private logger: Logger

    constructor(config?: S3ClientConfig) {
        this.s3 = new S3Client(config ?? {})
        this.logger = getLogger(S3ClientWrapper.name)

        this.logger.trace(`S3ClientWrapper initialized with config: ${JSON.stringify(config)}`)
    }

    async putObject(params: PutObjectCommand['input']) {
        try {
            this.logger.trace(`Putting object to S3 ${params.Bucket} at ${params.Key}`)

            const result = await this.s3.send(new PutObjectCommand(params))
            
            this.logger.trace(`Object put to S3 ${params.Bucket} at ${params.Key}`)

        } catch (error) {
            throw new Error(`Error putting object to S3. Bucket: ${params.Bucket}, Key: ${params.Key}`, { cause: error })
        }
    }

    /**
     * List given directory in S3 bucket. Calls ListObjectsV2Command with Delimiter set to '/' under the hood.
     * 
     * If dir is not provided, it will list all directories at the bucket root.
     * If dir is provided, it will list all directories under the given directory.
     * 
     * Dir can be passed either as "path/to/dir" or "path/to/dir/", final request will append a '/' to the dir if needed.
     * 
     * @param args - The parameters for the ListObjectsV2Command
     * @param prefix - The prefix to use for the list
     * @returns A list of directory names
     */
    async listDirectories(args: { bucket: string, dir?: string }) {
        
        const dirWithSlash = args.dir ? args.dir.endsWith('/') ? args.dir : `${args.dir}/` : undefined

        this.logger.trace(`Listing directories in S3 with prefix ${dirWithSlash ? `'${dirWithSlash}'` : "(undefined)"}`)

        const data = await this.s3.send(new ListObjectsV2Command({ Bucket: args.bucket, Prefix: dirWithSlash, Delimiter: '/' }))
        
        this.logger.trace(`Directories listed in S3 with prefix ${dirWithSlash ? `'${dirWithSlash}'` : "(undefined)"}: ${JSON.stringify(data.CommonPrefixes)}`)

        if(dirWithSlash) {
            return data.CommonPrefixes?.map(item => item.Prefix?.split(dirWithSlash).pop()?.split("/").shift() || '') || [] 
        } else {
            return data.CommonPrefixes?.map(item => item.Prefix?.split("/").shift() || '') || []
        }
    }

    async listObjectsV2(params: ListObjectsV2Command['input']) {
        try {
            this.logger.trace(`Listing objects in S3 with params: ${JSON.stringify(params)}`)

            const result = await this.s3.send(new ListObjectsV2Command(params))

            this.logger.trace(`Objects listed in S3 with params: ${JSON.stringify(params)}`)
            return result
        } catch (error) {
            throw new Error(`Error listing objects in S3. Params: ${JSON.stringify(params)}`, { cause: error })
        }
    }

    async headObject(params: HeadObjectCommand['input']) {
        try {
            this.logger.trace(`Checking object head in S3 with params: ${JSON.stringify(params)}`)

            const result = await this.s3.send(new HeadObjectCommand(params))

            this.logger.trace(`Object head checked in S3 with params: ${JSON.stringify(params)}`)
            return result
        } catch (error) {
            throw new Error(`Error checking object head in S3. Params: ${JSON.stringify(params)}`, { cause: error })
        }
    }

    /**
     * Check if an object exists in S3. Throws an error if there is an unexpected error (any error other than NotFound)
     * @param params - The parameters for the HeadObjectCommand
     * @returns true if the object exists, false otherwise. 
     */
    async exists(params: HeadObjectCommand['input']): Promise<boolean> {
        try {
            this.logger.trace(`Checking existence of object in S3 with params: ${JSON.stringify(params)}`)

            const result = await this.s3.send(new HeadObjectCommand(params))

            this.logger.trace(`Existence checked for object in S3 with params: ${JSON.stringify(params)}`)
            return result.ContentLength !== 0
        } catch (error) {
            if(error instanceof NotFound) {
                this.logger.trace(`Object not found in S3 with params: ${JSON.stringify(params)}`)
                return false
            }
            throw new Error(`Error checking object head in S3. Params: ${JSON.stringify(params)}`, { cause: error })
        }
    }

    async getObject(params: GetObjectCommand['input']) {
        try {
            this.logger.trace(`Getting object from S3 with params: ${JSON.stringify(params)}`)

            const result = await this.s3.send(new GetObjectCommand(params))

            this.logger.trace(`Object retrieved from S3 with params: ${JSON.stringify(params)}`)
            return result
        } catch (error) {
            throw new Error(`Error getting object from S3. Params: ${JSON.stringify(params)}`, { cause: error })
        }
    }

    async deleteObject(params: DeleteObjectCommand['input']) {
        try {
            this.logger.trace(`Deleting object from S3 with params: ${JSON.stringify(params)}`)

            const result = await this.s3.send(new DeleteObjectCommand(params))

            this.logger.trace(`Object deleted from S3 with params: ${JSON.stringify(params)}`)
            return result
        } catch (error) {
            throw new Error(`Error deleting object from S3. Params: ${JSON.stringify(params)}`, { cause: error })
        }
    }
}
