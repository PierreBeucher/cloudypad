import { InstanceStateV1 } from "./state";
import { StateWriter } from "./writer";
import { StateLoader } from "./loader";
import { StateSideEffect } from "./side-effects/abstract";
import { LocalStateSideEffect } from "./side-effects/local";
import { S3StateSideEffect } from "./side-effects/s3";
import { getLogger } from "../../log/utils";
import { GenericStateParser } from "./parser";

export interface StateManagerBuilderArgs {
    stateBackend: {
        local?: {
            dataRootDir: string
        }
        s3?: {
            bucketName: string
            region?: string
            accessKeyId?: string
            secretAccessKey?: string
            endpoint?: string
        }
    }
}

/**
 * The StateManagerBuilder is a builder for State managers: StateWriter, StateLoader and StateInitializer instances.
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
                bucketName: this.args.stateBackend.s3.bucketName,
                s3ClientConfig: {
                    region: this.args.stateBackend.s3.region,
                    // only pass creds if both keys and secret are provided
                    credentials:  this.args.stateBackend.s3.accessKeyId && this.args.stateBackend.s3.secretAccessKey ? {
                        accessKeyId: this.args.stateBackend.s3.accessKeyId,
                        secretAccessKey: this.args.stateBackend.s3.secretAccessKey
                    } : undefined,
                    endpoint: this.args.stateBackend.s3.endpoint
                }
            })
        }
        else {
            // only show keys to avoid showing secrets
            throw new Error(`Unknown state backend, one of local or s3 must be provided, got: ${JSON.stringify(Object.keys(this.args.stateBackend))}`)
        }

    }

    public buildStateWriter<ST extends InstanceStateV1>(parser: GenericStateParser<ST>): StateWriter<ST> {
        const writer = new StateWriter<ST>({
            sideEffect: this.buildSideEffect(),
            stateParser: parser
        })

        return writer
    }

    public buildStateLoader(): StateLoader {
        return new StateLoader({
            sideEffect: this.buildSideEffect()
        })
    }
}