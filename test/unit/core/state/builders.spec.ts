import * as assert from 'assert'
import { StateManagerBuilder } from "../../../../src/core/state/builders"
import { LOCAL_STATE_SIDE_EFFECT_NAME, LocalStateSideEffect } from '../../../../src/core/state/side-effects/local'
import { createTempTestDir, loadDumyAnonymousStateV1 } from '../../utils'
import { S3_STATE_SIDE_EFFECT_NAME, S3StateSideEffect } from '../../../../src/core/state/side-effects/s3'

describe('StateManagerBuilder', () => {


    const dummyState = loadDumyAnonymousStateV1("aws-dummy")

    it('local StateManagerBuilder should build local side effects', () => {
        const localSmb = new StateManagerBuilder({
            stateBackend: {
                local: {
                    dataRootDir: createTempTestDir("cloudypad-unit-test-state-manager-builder")
                }
            }
        })

        const writer = localSmb.buildStateWriter(dummyState)
        const loader = localSmb.buildStateLoader()
        const sideEffect = localSmb.buildSideEffect()

        assert.ok(sideEffect instanceof LocalStateSideEffect)
        assert.strictEqual(sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
        assert.strictEqual(writer.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
        assert.strictEqual(loader.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
    })

    it('should build s3 side effects', () => {

        const region = "dummy-region"
        const accessKeyId = "dummy-access-key-id"
        const secretAccessKey = "dummy-secret-access-key"
        const endpoint = "https://dummy-endpoint"

        const s3Smb = new StateManagerBuilder({
            stateBackend: {
                s3: {
                    bucketName: "dummy-bucket",
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey,
                    region: region,
                    endpoint: endpoint
                }
            }
        })

        const writer = s3Smb.buildStateWriter(dummyState)
        const loader = s3Smb.buildStateLoader()
        const sideEffect = s3Smb.buildSideEffect()

        assert.ok(sideEffect instanceof S3StateSideEffect)
        assert.strictEqual(sideEffect.name, S3_STATE_SIDE_EFFECT_NAME)        
        assert.strictEqual(writer.sideEffect.name, S3_STATE_SIDE_EFFECT_NAME)
        assert.strictEqual(loader.sideEffect.name, S3_STATE_SIDE_EFFECT_NAME)

        const s3SideEffect: S3StateSideEffect = sideEffect
        assert.deepStrictEqual(s3SideEffect.getS3ClientConfig(), {
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            },
            endpoint: endpoint
        })
    })

    it('should fail on non existing side effect depending on config', () => {
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