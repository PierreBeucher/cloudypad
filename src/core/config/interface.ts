import { z } from "zod"

export const CoreSdkConfigSchema = z.object({
    dataBackend: z.object({
        local: z.object({
            dataRootDir: z.string().describe("The root directory to use for local state management.")
        }).optional(),
        s3: z.object({
            config: z.object({
                region: z.string().describe("The region to use for S3 state management."),
                accessKeyId: z.string().describe("The access key ID to use for S3 state management."),
                secretAccessKey: z.string().describe("The secret access key to use for S3 state management."),
                endpointUrl: z.string().describe("The endpoint URL to use for S3 state management."),
            }).optional(),
            stateData: z.object({
                bucketName: z.string().describe("The name of the S3 bucket to use for state management.")
            }),
            pulumi: z.object({
                backendBucketName: z.string().describe("The name of the S3 bucket to use for pulumi state management."),
                stackPassphrase: z.string().describe("The passphrase to use for the Pulumi stack.").optional()
            }).describe("Pulumi backend to manage Pulumi stacks")
        }).optional()
    })
})

export type CoreSdkConfig = z.infer<typeof CoreSdkConfigSchema>