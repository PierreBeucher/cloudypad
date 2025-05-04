import { z } from "zod"

export const CoreSdkConfigSchema = z.object({
    stateBackend: z.object({
        local: z.object({
            dataRootDir: z.string().describe("The root directory to use for local state management.")
        }).optional(),
        s3: z.object({
            bucketName: z.string().describe("S3 bucket to use for state management."),
            region: z.string().optional(),
            accessKeyId: z.string().optional(),
            secretAccessKey: z.string().optional(),
            endpointUrl: z.string().optional(),
        }).optional().describe("S3 backend to manage state. Will use local AWS credentials by default with possible overrides.")
    }),
    pulumi: z.object({
        // should match LocalWorkspaceOptions object
        workspaceOptions: z.object({
            envVars: z.record(z.string(), z.string()).optional(),
        }).optional(),
    }).optional().describe("Pulumi configuration for providers using Pulumi. By default Pulumi use local backend under Cloudy Pad data home directory.")
})

export type CoreSdkConfig = z.infer<typeof CoreSdkConfigSchema>