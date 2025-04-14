import { InstanceStateV1 } from "./state";
import { StateWriter } from "./writer";
import { StateLoader } from "./loader";
import { StateSideEffect } from "./side-effect";
import { ConfigManager } from "../config/manager";
import { LocalStateSideEffect } from "./local/side-effect";

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
    private getSideEffect(): StateSideEffect {
        
        const cloudyPadConfig = ConfigManager.getInstance().load()
        const sideEffectBuilder = sideEffectBuilders[cloudyPadConfig.stateBackend]

        if(!sideEffectBuilder) {
            throw new Error(`Unsupported backend: ${cloudyPadConfig.stateBackend}`)
        }

        return sideEffectBuilder.buildSideEffect()
    }

    public buildStateWriter<ST extends InstanceStateV1>(state: ST): StateWriter<ST> {
        return new StateWriter({
            state: state,
            sideEffect: this.getSideEffect()
        })
    }

    public buildStateLoader(): StateLoader {
        return new StateLoader({
            sideEffect: this.getSideEffect()
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

    public abstract buildSideEffect(): StateSideEffect
}

export class LocalSideEffectBuilder extends SideEffectBuilder {

    public buildSideEffect(): StateSideEffect {
        return new LocalStateSideEffect({
            dataRootDir: ConfigManager.getEnvironmentDataRootDir()
        })
    }
}

const sideEffectBuilders: { [key: string]: SideEffectBuilder } = {
    local: new LocalSideEffectBuilder()
}

export function registerSideEffectBuilder(backend: string, builder: SideEffectBuilder): void {
    sideEffectBuilders[backend] = builder
}