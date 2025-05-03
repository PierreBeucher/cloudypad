import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import { getLogger } from '../log/utils'
import { v4 as uuidv4 } from 'uuid'
import * as lodash from 'lodash'
import { DefaultConfigValues } from '../core/config/default'

export enum AnalyticsCollectionMethod {
    All = "all",
    Technical = "technical",
    None = "none"
}

const PostHogConfigSchema = z.object({
    distinctId: z.string(),
    collectionMethod: z.enum([ AnalyticsCollectionMethod.All, AnalyticsCollectionMethod.Technical, AnalyticsCollectionMethod.None ]).optional()
        .describe("The method used to collect analytics data. All: collect everything, including personal data (require user consent). Technical: only collect technical non-personal data. None: do not collect anything."),
})

const AnalyticsConfigSchema = z.object({
    promptedPersonalDataCollectionApproval: z.boolean().default(false).describe("Whether user has been prompted for personal data collection approval yet."),
    posthog: PostHogConfigSchema
})

export const CloudyPadGlobalConfigSchemaV1 = z.object({
    version: z.literal("1"),
    analytics: AnalyticsConfigSchema,
}).describe("PostHog analytics config. https://posthog.com")

export type PostHogConfig = z.infer<typeof PostHogConfigSchema>
export type CloudyPadGlobalConfigV1 = z.infer<typeof CloudyPadGlobalConfigSchemaV1>
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>

export const BASE_DEFAULT_CONFIG: CloudyPadGlobalConfigV1 = {
    version: "1",
    analytics: {
        promptedPersonalDataCollectionApproval: false,
        posthog: { 
            distinctId: "dummy",
            collectionMethod: AnalyticsCollectionMethod.Technical
        },
    },
}

/**
 * Manages Cloudy Pad config globally. Use Singleton pattern to ensure any app component can get access
 * to global environment config.
 * 
 * Configuration is stored locally in ${dataRootDir}/config.yml
 */
export class ConfigManager {

    private static instance: ConfigManager

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager()
        }
        return ConfigManager.instance
    }

    private configPath: string
    private dataRootDir: string
    private logger = getLogger(ConfigManager.name)

    /**
     * Do not call constructor directly. Use getInstance() instead. (Can be used for testing purpose)
     * @param dataRootDir Do not use default dataRootDir. 
     */
    constructor(dataRootDir?: string) {
        this.dataRootDir = dataRootDir ?? DefaultConfigValues.defaultLocalDataRootDir()
        this.configPath = path.join(this.dataRootDir, 'config.yml')
    }


    /**
     * Initialize configuration if needed:
     * - Create default config.yml in root data dir if none already exists, prompting user for details
     * - If one already exists, parse it
     */
    init(): void {
        if (!fs.existsSync(this.configPath)) {
            this.logger.info(`CLI config not found at ${this.configPath}. Creating default config...`)
            
            const initConfig = lodash.merge(
                {},
                BASE_DEFAULT_CONFIG, 
                { 
                    analytics: { 
                        posthog: { 
                            distinctId: uuidv4(),
                            collectionMethod: "technical"
                        } 
                    } 
                }
            )
            this.writeConfigSafe(initConfig)

            this.logger.debug(`Generated default config: ${JSON.stringify(initConfig)}`)
            this.logger.info(`Default config created at ${this.configPath}`)
        }

        this.logger.debug(`Init: found existing config at ${this.configPath}. Not overwriting it.`)
    }

    load(): CloudyPadGlobalConfigV1 {
        const rawConfig = this.readConfigRaw()
        const config = this.zodParseSafe(rawConfig, CloudyPadGlobalConfigSchemaV1)
        this.writeConfigSafe(config) // Rewrite config with correct schema version as current schema may have changed since last load
        return config
    }

    setAnalyticsPromptedPersonalDataCollectionApproval(prompted: boolean): void {
        this.logger.debug(`Updating promptedApproval: ${prompted}`)

        const updatedConfig = this.load()
        updatedConfig.analytics.promptedPersonalDataCollectionApproval = prompted
        this.writeConfigSafe(updatedConfig)
    }

    setAnalyticsCollectionMethod(collectionMethod: AnalyticsCollectionMethod): void {
        this.logger.debug(`Setting analytics collection method: ${collectionMethod}`)

        const updatedConfig = this.load()
        updatedConfig.analytics.posthog.collectionMethod = collectionMethod
        this.writeConfigSafe(updatedConfig)
    }

    setAnalyticsPosthHog(posthog: PostHogConfig): void {
        this.logger.debug(`Setting PostHog analytics: ${JSON.stringify(posthog)}`)

        const updatedConfig = this.load()
        updatedConfig.analytics.posthog = lodash.merge({}, updatedConfig.analytics.posthog, posthog)
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

    private writeConfigSafe(unsafeConfig: CloudyPadGlobalConfigV1): void {
        try {
            this.logger.debug(`Writing config ${JSON.stringify(unsafeConfig)} at ${this.configPath}...`)

            // Create data root directory if not exists
            if (!fs.existsSync(this.dataRootDir)) {
                this.logger.debug(`Creating data root directory '${this.dataRootDir}'`)
                fs.mkdirSync(this.dataRootDir, { recursive: true })
            }

            const parsedConfig = this.zodParseSafe(unsafeConfig, CloudyPadGlobalConfigSchemaV1)
            const yamlContent = yaml.dump(parsedConfig)
            fs.writeFileSync(this.configPath, yamlContent, 'utf-8')

            this.logger.debug(`Wrote parsed config ${JSON.stringify(parsedConfig)} at ${this.configPath}...`)
        } catch (e) {
            throw new Error(`Couldn't write config ${JSON.stringify(unsafeConfig)} at ${this.configPath}`, { cause: e })
        }
    }

    private zodParseSafe<T extends z.AnyZodObject>(data: unknown, schema: T): z.infer<T> {
        const result = schema.safeParse(data)
        if (result.success) {
            return result.data as z.infer<T>
        } else {
            throw new Error(`Couldn't parse Config with Zod. Config is either corrupted or not compatible with this Cloudy Pad version. If you think this is a bug, please create an issue. Error state: ${JSON.stringify(data)}; Zod error: ${JSON.stringify(result.error.format())}`, { cause: result.error })
        }
    }
}

