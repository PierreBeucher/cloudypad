import { InstanceStateV1 } from "./state";
import { StateWriter } from "./writer";
import { StateLoader } from "./loader";
import { StateSideEffect } from "./side-effects/abstract";
import { LocalStateSideEffect } from "./side-effects/local";
import { S3StateSideEffect } from "./side-effects/s3";
import { getLogger } from "../../log/utils";

export interface StateManagerBuilderArgs {
    stateBackend: {
        local?: {
            dataRootDir: string
        }
        s3?: {
            bucketName: string
        }
    }
}

/**
 * The StateManagerBuilder is a singleton builder for State managers: StateWriter, StateLoader and StateInitializer instances.
 * Singleton pattern is used here as State manager behaviors depends on current environments's Cloudy Pad config.
 */
export class StateManagerBuilder {

    private logger = getLogger(StateManagerBuilder.name)

    private readonly args: StateManagerBuilderArgs

    constructor(args: StateManagerBuilderArgs) {
        if(args.stateBackend.local && args.stateBackend.s3 || !args.stateBackend.local && !args.stateBackend.s3) {
            throw new Error(`Exactly one of local or s3 must be provided, got: ${JSON.stringify(Object.keys(args.stateBackend))}`)
        }
        this.args = args
    }

    /**
     * Return a SideEffect for this builder's configuration.
     */
    public buildSideEffect(): StateSideEffect {

        this.logger.debug(`Building side effect for state backend: ${JSON.stringify(this.args.stateBackend)}`)

        if(this.args.stateBackend.local) {
            return new LocalStateSideEffect({
                dataRootDir: this.args.stateBackend.local.dataRootDir
            })
        }
        else if(this.args.stateBackend.s3) {
            return new S3StateSideEffect({
                bucketName: this.args.stateBackend.s3.bucketName
            })
        }
        else {
            // only show keys to avoid showing secrets
            throw new Error(`Unknown state backend, one of local or s3 must be provided, got: ${JSON.stringify(Object.keys(this.args.stateBackend))}`)
        }

    }

    public buildStateWriter<ST extends InstanceStateV1>(state?: ST): StateWriter<ST> {
        const writer = new StateWriter<ST>({
            sideEffect: this.buildSideEffect()
        })

        if(state) {
            writer.setState(state)
        }

        return writer
    }

    public buildStateLoader(): StateLoader {
        return new StateLoader({
            sideEffect: this.buildSideEffect()
        })
    }
}