import * as assert from 'assert'
import { buildSideEffect, LocalSideEffectBuilder, registerSideEffectBuilder, SideEffectBuilder, StateManagerBuilder } from "../../../../src/core/state/builders"
import { LOCAL_STATE_SIDE_EFFECT_NAME, LocalStateSideEffect } from '../../../../src/core/state/side-effects/local'
import { loadDumyAnonymousStateV1 } from '../../utils'
import { StateSideEffect } from '../../../../src/core/state/side-effects/abstract'
import { InstanceStateV1 } from '../../../../src/core/state/state'

describe('StateManagerBuilder', () => {
    const stateManagerBuilder = StateManagerBuilder.getInstance()
    const dummyState = loadDumyAnonymousStateV1("aws-dummy")

    it('should return a singleton instance', () => {
        const instance1 = StateManagerBuilder.getInstance()
        const instance2 = StateManagerBuilder.getInstance()
        assert.strictEqual(instance1, instance2)
    })

    it('should build a StateWriter with default local side effect', () => {
        const writer = stateManagerBuilder.buildStateWriter(dummyState)
        assert.strictEqual(writer.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
    })

    it('should build a StateLoader with default local side effect', () => {
        const loader = stateManagerBuilder.buildStateLoader()
        assert.strictEqual(loader.sideEffect.name, LOCAL_STATE_SIDE_EFFECT_NAME)
    })

    it('should fail on non existing side effect', () => {
        assert.throws(() => buildSideEffect("dummy-test"), /Unknown Side Effect backend: dummy-test/)
    })

    it('should register a new SideEffectBuilder', () => {

        class DummyTestSideEffect extends StateSideEffect {
            constructor() {
                super("dummy-test")
            }
            async listInstances(): Promise<string[]> { return [] }
            async instanceExists(_: string): Promise<boolean> { return false }
            protected doPersistState<ST extends InstanceStateV1>(_: ST): Promise<void> { throw new Error('Method not implemented.')}
            loadRawInstanceState(_: string): Promise<unknown> { throw new Error('Method not implemented.') }
            destroyState(_: string): Promise<void> { throw new Error('Method not implemented.') }
        }

        class DummyTestSideEffectBuilder extends SideEffectBuilder {
            build(): StateSideEffect {
                return new DummyTestSideEffect()
            }
        }

        registerSideEffectBuilder("dummy-test", new DummyTestSideEffectBuilder())
        const sideEffect = buildSideEffect("dummy-test")
        assert.strictEqual(sideEffect.name, "dummy-test")
    })
})