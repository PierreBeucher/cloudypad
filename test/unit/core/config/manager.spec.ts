import * as fs from 'fs'
import * as assert from 'assert'
import * as yaml from 'js-yaml'
import { ConfigManager, BASE_DEFAULT_CONFIG, GlobalCliConfigV1, GlobalCliConfigSchemaV1 } from '../../../../src/core/config/manager'
import { createTempTestDir } from '../../utils'
import path from 'path'
import lodash from 'lodash'
import { PartialDeep } from 'type-fest'

describe('ConfigManager', () => {

    describe('Initialization', () => {
        it('init should create default config without overwriting existing config', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-init")
            const configManager = new ConfigManager(tmpDataRootDir)
            configManager.init()

            // Ensure config has been written and is parseable wirh Zod
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")
            assert.ok(fs.existsSync(expectConfigPath), 'Default config file should be created')

            const writtenConfigRaw = yaml.load(fs.readFileSync(expectConfigPath, 'utf-8'))
            const writtenConfigParsed = GlobalCliConfigSchemaV1.safeParse(writtenConfigRaw)
            assert.equal(writtenConfigParsed.success, true, 'Config should be parseable with Zod')

            const writtenConfig = writtenConfigParsed.data!
            
            assert.equal(writtenConfig.version, "1")
            assert.equal(writtenConfig.analytics.enabled, BASE_DEFAULT_CONFIG.analytics.enabled)
            assert.equal(writtenConfig.analytics.promptedApproval, BASE_DEFAULT_CONFIG.analytics.promptedApproval)
            // assert distinctId looks like a UUID
            assert.match(writtenConfig.analytics.posthog.distinctId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

            // Check loaded config match file content
            const loadedConfig = configManager.load()
            assert.deepEqual(loadedConfig, writtenConfig, 'Loaded config should match file content')

            // Calling init() again should not overwrite
            // Update config (and check it's been updated)
            // and call init() again to see if existing config is not overwritten
            configManager.updateAnalyticsPromptedApproval(!loadedConfig.analytics.promptedApproval)
            const expectUpdatedConfig = lodash.merge({},
                loadedConfig,
                {
                    analytics: {
                        promptedApproval: !loadedConfig.analytics.promptedApproval
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

        const configUpdateTestManager = new ConfigManager(createTempTestDir("config-manager-update"))
        configUpdateTestManager.init()

        it('should update prompted approval', () => {

            const configBeforeUpdate = configUpdateTestManager.load()
            assert.equal(configBeforeUpdate.analytics.promptedApproval, false)

            configUpdateTestManager.updateAnalyticsPromptedApproval(true)
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.promptedApproval, true)
        })

        it('should update PostHog analytics', () => {
            configUpdateTestManager.setAnalyticsPosthHog({ distinctId: "distinct-id-unit-test"})
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.posthog?.distinctId, "distinct-id-unit-test")
        })

        it('should update analytics enabled', () => {
            const configBeforeUpdate = configUpdateTestManager.load()
            assert.equal(configBeforeUpdate.analytics.enabled, true)

            configUpdateTestManager.setAnalyticsEnabled(false)
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.enabled, false)
        })

    })

    describe('Configuration Loading', () => {
        it('should load and parse configuration correctly', () => {
            const dummyConfigDiff: PartialDeep<GlobalCliConfigV1> = {
                analytics: {
                    enabled: true,
                    posthog: {
                        distinctId: "foo"
                    }
                }
            }
            const dummyConfig = lodash.merge({}, BASE_DEFAULT_CONFIG, dummyConfigDiff)
            const tmpDataRootDir = createTempTestDir("config-manager-load")
            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")
            
            // Write dummy config
            fs.writeFileSync(expectConfigPath, yaml.dump(dummyConfig), "utf-8")

            // Try to load
            const configManager = new ConfigManager(tmpDataRootDir)
            const loadedConfig = configManager.load()

            assert.deepStrictEqual(loadedConfig, dummyConfig, 'Loaded config should match the written config')
        })

        it('should throw an error if config file is missing', () => {
            const tmpDataRootDir = createTempTestDir("config-manager-load-err")
            const configManager = new ConfigManager(tmpDataRootDir)

            assert.throws(
                () => configManager.load(),
                /Couldn't load config at/,
                'Should throw an error if config file does not exist'
            )
        })
    })
})
