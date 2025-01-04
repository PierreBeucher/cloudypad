import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import { DataRootDirManager } from '../data-dir'
import { getLogger } from '../../log/utils'

const PostHogConfigSchema = z.object({
    distinctId: z.string()
})

const AnalyticsConfigSchema = z.object({
    enabled: z.boolean().describe("Whether analytics is enabled."),
    promptedApproval: z.boolean().describe("Whether user has been prompted for analytics approval yet."),
    posthog: PostHogConfigSchema.optional()
}).refine(
    (data) => !data.enabled || (data.enabled && data.posthog !== undefined),
    {
        message: 'PostHog configuration is required when analytics is enabled',
        path: ['posthog'] // Optional: Point to the specific field in error
    }
)

const GlobalCliConfigSchemaV1 = z.object({
    version: z.literal("1"),
    analytics: AnalyticsConfigSchema
}).describe("PostHog analytics config. https://posthog.com")

export type PostHogConfig = z.infer<typeof PostHogConfigSchema>
export type GlobalCliConfigV1 = z.infer<typeof GlobalCliConfigSchemaV1>
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>

export function getCliConfigPath(){
    const dataRoot = DataRootDirManager.getEnvironmentDataRootDir()
    return path.join(dataRoot, 'config.yml')
}

export const DEFAULT_CONFIG: GlobalCliConfigV1 = {
    version: "1",
    analytics: {
        enabled: false,
        promptedApproval: false
    }
}

/**
 * Manages CLI config globally. Use Singleton pattern to ensure any app component can get access
 * to global config.
 */
export class ConfigManager {
    private static instance: ConfigManager
    private configPath: string
    private logger = getLogger(ConfigManager.name)

    /**
     * Do not call constructor directly. Use getInstance() instead.
     * @param dataRootDir Do not use default dataRootDir. 
     */
    constructor(dataRootDir?: string) {
        this.configPath = dataRootDir ? path.join(dataRootDir, "config.yml") : getCliConfigPath()
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager()
        }
        return ConfigManager.instance
    }

    /**
     * Initialize configuration if needed:
     * - Create default config.yml in root data dir if none already exists, prompting user for details
     * - If one already exists, parse it
     */
    init(): void {
        if (!fs.existsSync(this.configPath)) {
            this.logger.info(`CLI config not found at ${this.configPath}. Creating default config...`)
            this.writeConfigSafe(DEFAULT_CONFIG)
            this.logger.info(`Default config created at ${this.configPath}`)
        }

        this.logger.debug(`Found existing config at ${this.configPath}.`)
    }

    load(): GlobalCliConfigV1 {
        const rawConfig = this.readConfigRaw()
        const config = this.zodParseSafe(rawConfig, GlobalCliConfigSchemaV1)
        return config
    }

    updateAnalyticsPromptedApproval(prompted: boolean): void {
        this.logger.debug(`Updating promptedApproval: ${prompted}`)

        const updatedConfig = this.load()
        updatedConfig.analytics.promptedApproval = prompted
        this.writeConfigSafe(updatedConfig)
    }

    enableAnalyticsPosthHog(posthog: PostHogConfig): void {
        this.logger.debug(`Enabling PostHog analytics: ${posthog}`)

        const updatedConfig = this.load()
        updatedConfig.analytics.enabled = true
        updatedConfig.analytics.posthog = posthog
        this.writeConfigSafe(updatedConfig)
    }

    disableAnalytics(): void {
        this.logger.debug(`Disabling analytics`)

        const updatedConfig = this.load()
        updatedConfig.analytics.enabled = false
        this.writeConfigSafe(updatedConfig)
    }

    private readConfigRaw(): unknown {
        try {
            this.logger.debug(`Reading config at ${this.configPath}`)

            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Config file not found at ${this.configPath}`)
            }

            const rawConfig = fs.readFileSync(this.configPath, 'utf-8')
            const rawYaml = yaml.load(rawConfig)

            this.logger.debug(`Read config at ${this.configPath}: ${JSON.stringify(rawYaml)}`)

            return rawYaml
        } catch (e) {
            throw new Error(`Couldn't load config at ${this.configPath}`, { cause: e})
        }
    }

    private writeConfigSafe(unsafeConfig: GlobalCliConfigV1): void {
        try {
            this.logger.debug(`Writing config ${JSON.stringify(unsafeConfig)} at ${this.configPath}...`)

            const parsedConfig = this.zodParseSafe(unsafeConfig, GlobalCliConfigSchemaV1)
            const yamlContent = yaml.dump(parsedConfig)
            fs.writeFileSync(this.configPath, yamlContent, 'utf-8')

            this.logger.debug(`Wrote parsed config ${JSON.stringify(parsedConfig)} at ${this.configPath}...`)
        } catch (e) {
            this.logger.error(`Couldn't write config ${JSON.stringify(unsafeConfig)} at ${this.configPath}`, e)
            throw new Error(`Couldn't write config ${JSON.stringify(unsafeConfig)} at ${this.configPath}: ${e}`)
        }
    }

    private zodParseSafe<T extends z.AnyZodObject>(data: unknown, schema: T): z.infer<T> {
        const result = schema.safeParse(data)
        if (result.success) {
            return result.data as z.infer<T>
        } else {
            throw new Error(`Couldn't parse Config with Zod. Config is either corrupted or not compatible with this Cloudy Pad version. If you think this is a bug, please create an issue. Error state: ${JSON.stringify(data)}; Zod error: ${JSON.stringify(result.error.format())}`)
        }
    }
}

