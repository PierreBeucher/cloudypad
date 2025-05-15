import * as fs from 'fs'
import * as assert from 'assert'
import * as yaml from 'yaml'
import { CliConfigManager, BASE_DEFAULT_CONFIG, CloudyPadGlobalConfigV1, CloudyPadGlobalConfigSchemaV1, AnalyticsCollectionMethod } from '../../../src/cli/config'
import { createTempTestDir } from '../utils'
import path from 'path'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'

describe('ConfigManager', () => {

    describe('Initialization', () => {
        it('init should create default config without overwriting existing config', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-init")
            const configManager = new CliConfigManager(tmpDataRootDir)
            configManager.init()

            // Ensure config has been written and is parseable wirh Zod
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")
            assert.ok(fs.existsSync(expectConfigPath), 'Default config file should be created')

            const writtenConfigRaw = yaml.parse(fs.readFileSync(expectConfigPath, 'utf-8'))
            const writtenConfigParsed = CloudyPadGlobalConfigSchemaV1.safeParse(writtenConfigRaw)
            assert.equal(writtenConfigParsed.success, true, 'Config should be parseable with Zod')

            const writtenConfig = writtenConfigParsed.data!
            
            assert.equal(writtenConfig.version, "1")
            assert.equal(writtenConfig.analytics.promptedPersonalDataCollectionApproval, BASE_DEFAULT_CONFIG.analytics.promptedPersonalDataCollectionApproval)
            // assert distinctId looks like a UUID
            assert.match(writtenConfig.analytics.posthog.distinctId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

            // Check loaded config match file content
            const loadedConfig = configManager.load()
            assert.deepEqual(loadedConfig, writtenConfig, 'Loaded config should match file content')

            // Calling init() again should not overwrite
            // Update config (and check it's been updated)
            // and call init() again to see if existing config is not overwritten
            configManager.setAnalyticsPromptedPersonalDataCollectionApproval(!loadedConfig.analytics.promptedPersonalDataCollectionApproval)
            const expectUpdatedConfig = lodash.merge({},
                loadedConfig,
                {
                    analytics: {
                        promptedPersonalDataCollectionApproval: !loadedConfig.analytics.promptedPersonalDataCollectionApproval
                    }
                }
            )

            const updatedResult = configManager.load()
            assert.deepStrictEqual(updatedResult, expectUpdatedConfig, 'Updated config should match expected updated config')

            // Calling init() again should not overwrite
            configManager.init()
            const updatedResultAfterInitBis = configManager.load()
            assert.deepStrictEqual(updatedResultAfterInitBis, expectUpdatedConfig, 'Config should not change after second call to init')
        })
    })

    describe('Config update', () => {

        const configUpdateTestManager = new CliConfigManager(createTempTestDir("config-manager-update"))
        configUpdateTestManager.init()

        it('should update prompted approval', () => {

            const configBeforeUpdate = configUpdateTestManager.load()
            assert.equal(configBeforeUpdate.analytics.promptedPersonalDataCollectionApproval, false)

            configUpdateTestManager.setAnalyticsPromptedPersonalDataCollectionApproval(true)
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.promptedPersonalDataCollectionApproval, true)
        })

        it('should update PostHog analytics', () => {
            configUpdateTestManager.setAnalyticsPosthHog({ distinctId: "distinct-id-unit-test"})
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.posthog?.distinctId, "distinct-id-unit-test")
        })

        it("should update analytics collection method", () => {
            const configBeforeUpdate = configUpdateTestManager.load()
            assert.equal(configBeforeUpdate.analytics.posthog?.collectionMethod, AnalyticsCollectionMethod.Technical, "Should start test with technical collection method to avoid false positives")

            configUpdateTestManager.setAnalyticsCollectionMethod(AnalyticsCollectionMethod.All)
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.posthog?.collectionMethod, AnalyticsCollectionMethod.All)
        })

    })

    // Some fields have been removed or renamed in schema
    // Ensure configs loaded with or without old fields are correctly handled
    describe('Configuration schema change handling', () => {
        it('should load and update config with old "enabled" field', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-load-with-old-enabled")
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")

            /// Generate dummy config with old "enabled" field
            fs.writeFileSync(expectConfigPath, yaml.stringify(lodash.merge({}, BASE_DEFAULT_CONFIG, {
                analytics: {
                    enabled: true,
                }
            })), "utf-8")

            const configManager = new CliConfigManager(tmpDataRootDir)
            const loadedConfig = configManager.load() as any

            // Check config now has correct schema
            // and config file on disk has been rewritten with correct schema
            assert.equal(loadedConfig.analytics.enabled, undefined)

            const writtenConfig = yaml.parse(fs.readFileSync(expectConfigPath, 'utf-8'))
            assert.deepEqual(writtenConfig, BASE_DEFAULT_CONFIG)
        })

        // promptedApproval is now promptedPersonalDataCollectionApproval
        // promptedPersonalDataCollectionApproval is missing from old schema
        it('should load and update config with old "promptedApproval" field', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-load-with-old-promptedApproval")
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")

            const oldConfig = lodash.cloneDeep(BASE_DEFAULT_CONFIG) as any
            oldConfig.analytics.promptedPersonalDataCollectionApproval = undefined
            oldConfig.analytics.promptedApproval = true
            fs.writeFileSync(expectConfigPath, yaml.stringify(oldConfig), "utf-8")

            const configManager = new CliConfigManager(tmpDataRootDir)
            const loadedConfig = configManager.load() as any

            // Check config now has correct schema
            // and config file on disk has been rewritten with correct schema
            assert.equal(loadedConfig.analytics.promptedPersonalDataCollectionApproval, BASE_DEFAULT_CONFIG.analytics.promptedPersonalDataCollectionApproval, "promptedPersonalDataCollectionApproval should be BASE_DEFAULT_CONFIG.analytics.promptedPersonalDataCollectionApproval")
            assert.equal(loadedConfig.analytics.promptedApproval, undefined, "promptedApproval should be undefined")

            const writtenConfig = yaml.parse(fs.readFileSync(expectConfigPath, 'utf-8'))
            assert.deepEqual(writtenConfig, BASE_DEFAULT_CONFIG)
        })
    })

    describe('Configuration Loading', () => {
        it('should load and parse configuration correctly', () => {
            const dummyConfigDiff: PartialDeep<CloudyPadGlobalConfigV1> = {
                analytics: {
                    posthog: {
                        distinctId: "foo",
                    }
                }
            }
            const dummyConfig = lodash.merge({}, BASE_DEFAULT_CONFIG, dummyConfigDiff)
            const tmpDataRootDir = createTempTestDir("config-manager-load")
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")
            
            // Write dummy config
            fs.writeFileSync(expectConfigPath, yaml.stringify(dummyConfig), "utf-8")

            // Try to load
            const configManager = new CliConfigManager(tmpDataRootDir)
            const loadedConfig = configManager.load()

            assert.deepStrictEqual(loadedConfig, dummyConfig, 'Loaded config should match the written config')
        })

        it('should throw an error if config file is missing', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-load-err")
            const configManager = new CliConfigManager(tmpDataRootDir)

            assert.throws(
                () => configManager.load(),
                /Couldn't load config at/,
                'Should throw an error if config file does not exist'
            )
        })
    })
})
