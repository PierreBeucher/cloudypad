import * as fs from 'fs'
import * as assert from 'assert'
import * as yaml from 'js-yaml'
import { ConfigManager, DEFAULT_CONFIG, GlobalCliConfigV1 } from '../../../../src/core/config/manager'
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

            const expectConfigPath = path.join(tmpDataRootDir, "config.yml")
            assert.ok(fs.existsSync(expectConfigPath), 'Default config file should be created')
            const writtenConfig = yaml.load(fs.readFileSync(expectConfigPath, 'utf-8'))
            assert.deepStrictEqual(writtenConfig, DEFAULT_CONFIG, 'Written config should match default config')

            // Updating config should be taken into account
            configManager.updateAnalyticsPromptedApproval(true)
            const expectUpdatedConfig = lodash.merge({},
                DEFAULT_CONFIG,
                {
                    analytics: {
                        promptedApproval: true
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

            const configBeforeUpdate = configUpdateTestManager.load()
            assert.equal(configBeforeUpdate.analytics.posthog, undefined)

            // Update and check OK
            configUpdateTestManager.enableAnalyticsPosthHog({ distinctId: "dummy"})
            const configAfterUpdate = configUpdateTestManager.load()
            assert.equal(configAfterUpdate.analytics.posthog?.distinctId, "dummy")
            assert.equal(configAfterUpdate.analytics.enabled, true)

            configUpdateTestManager.disableAnalytics()
            const configAfterUpdateBis = configUpdateTestManager.load()
            assert.equal(configAfterUpdateBis.analytics.enabled, false)
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
            const dummyConfig = lodash.merge({}, DEFAULT_CONFIG, dummyConfigDiff)
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
