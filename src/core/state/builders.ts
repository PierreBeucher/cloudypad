import { InstanceStateV1 } from "./state";
import { StateWriter } from "./writer";
import { StateLoader } from "./loader";
import { StateSideEffect } from "./side-effects/abstract";
import { ConfigManager } from "../config/manager";
import { LocalStateSideEffect } from "./side-effects/local";
import { S3SideEffectBuilder } from "./side-effects/s3";

/**
 * The StateManagerBuilder is a singleton builder for State managers: StateWriter, StateLoader and StateInitializer instances.
 * Singleton pattern is used here as State manager behaviors depends on current environments's Cloudy Pad config.
 */
export class StateManagerBuilder {
    private static instance: StateManagerBuilder;

    private constructor() {}

    public static getInstance(): StateManagerBuilder {
        if (!StateManagerBuilder.instance) {
            StateManagerBuilder.instance = new StateManagerBuilder();
        }
        return StateManagerBuilder.instance;
    }

    /**
     * Return a SideEffect for the current environment's configuration.
     */
    private buildSideEffect(): StateSideEffect {
        const cloudyPadConfig = ConfigManager.getInstance().load()
        return buildSideEffect(cloudyPadConfig.stateBackend)
    }

    public buildStateWriter<ST extends InstanceStateV1>(state: ST): StateWriter<ST> {
        return new StateWriter({
            state: state,
            sideEffect: this.buildSideEffect()
        })
    }

    public buildStateLoader(): StateLoader {
        return new StateLoader({
            sideEffect: this.buildSideEffect()
        })
    }
}

/*
* SideEffectBuilders are used to build Side effects for different state backends.
* By default only the local backend is supported with LocalSideEffectBuilder.
* 
* It's possible to register more SideEffectBuilders for various backends identified by a string key.
*/

export abstract class SideEffectBuilder {

    public abstract build(): StateSideEffect
}

export class LocalSideEffectBuilder extends SideEffectBuilder {

    public build(): StateSideEffect {
        return new LocalStateSideEffect({
            dataRootDir: ConfigManager.getEnvironmentDataRootDir()
        })
    }
}

const sideEffectBuilders: { [key: string]: SideEffectBuilder } = {
    local: new LocalSideEffectBuilder(),
    s3: new S3SideEffectBuilder()
}

export function registerSideEffectBuilder(backend: string, builder: SideEffectBuilder): void {
    sideEffectBuilders[backend] = builder
}

export function buildSideEffect(backend: string): StateSideEffect {
    const builder = sideEffectBuilders[backend]
    if(!builder) {
        throw new Error(`Unknown Side Effect backend: ${backend}`)
    }
    return builder.build()
}