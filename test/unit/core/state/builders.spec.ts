import * as assert from 'assert'
import { StateManagerBuilder } from "../../../../src/core/state/builders"
import { LOCAL_STATE_SIDE_EFFECT_NAME, LocalStateSideEffect } from '../../../../src/core/state/side-effects/local'
import { createTempTestDir, loadDumyAnonymousStateV1 } from '../../utils'
import { StateSideEffect } from '../../../../src/core/state/side-effects/abstract'
import { InstanceStateV1 } from '../../../../src/core/state/state'
import { S3StateSideEffect } from '../../../../src/core/state/side-effects/s3'

describe('StateManagerBuilder', () => {


    const smb = new StateManagerBuilder({
        stateBackend: {
            local: {
                dataRootDir: createTempTestDir("cloudypad-unit-test-state-manager-builder")
            }
        }
    })

    const dummyState = loadDumyAnonymousStateV1("aws-dummy")

    it('should return a singleton instance', () => {
        const instance1 = smb
        const instance2 = smb
        assert.strictEqual(instance1, instance2)
    })

    it('should build a StateWriter with default local side effect', () => {
        const writer = smb.buildStateWriter(dummyState)
        assert.strictEqual(writer.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
    })

    it('should build a StateLoader with default local side effect', () => {
        const loader = smb.buildStateLoader()
        assert.strictEqual(loader.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
    })

    it('should fail on non existing side effect depending on config', () => {
        const localSmb = new StateManagerBuilder({
            stateBackend: {
                local: {
                    dataRootDir: createTempTestDir("cloudypad-unit-test-state-manager-builder")
                }
            }
        })

        const localSideEffect = localSmb.buildSideEffect()
        assert.ok(localSideEffect instanceof LocalStateSideEffect)

        const s3Smb = new StateManagerBuilder({
            stateBackend: {
                s3: {
                    bucketName: "dummy-bucket"
                }
            }
        })

        assert.throws(() => {
            const unknownSmb = new StateManagerBuilder({
                stateBackend: {}
            })
        }, /Exactly one of local or s3 must be provided/)

        assert.throws(() => {
            const tooManySmb = new StateManagerBuilder({
                stateBackend: {
                    local: {
                        dataRootDir: createTempTestDir("cloudypad-unit-test-state-manager-builder")
                    },
                    s3: {
                        bucketName: "dummy-bucket"
                    }
                }
            })
        }, /Exactly one of local or s3 must be provided/)
    })
})