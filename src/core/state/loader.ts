import { getLogger } from '../../log/utils'
import { AnonymousStateParser } from './parser'
import { InstanceStateV1 } from './state'
import { StateSideEffect } from './side-effect'

export interface StateLoaderArgs {
    sideEffect: StateSideEffect
}

export class StateLoader {

    private logger = getLogger(StateLoader.name)
    private readonly args: StateLoaderArgs

    constructor(args: StateLoaderArgs) {
        this.args = args
    }

    listInstances(): string[] {
        return this.args.sideEffect.listInstances()
    }

    /**
     * Check an instance exists. An instance is considering existing if the folder
     * ${dataRootDir}/instances/<instance_name> exists and contains a state. 
     */
    async instanceExists(instanceName: string): Promise<boolean> {
        return this.args.sideEffect.instanceExists(instanceName)
    }

    /**
     * Load raw instance state from disk. Loaded state is NOT type-checked.
     * First try to load state V1, then State V0 before failing
     */
    async loadRawInstanceState(instanceName: string): Promise<unknown> {
        return this.args.sideEffect.loadRawInstanceState(instanceName)
    }

    /**
     * Load an instance state to the latest version safely (by validating schema and throwing on error)
     * This method should be called before trying to parse the state for a provider
     */
    async loadInstanceState(instanceName: string): Promise<InstanceStateV1> {

        // read state as-is, any is acceptable at this point
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawState = await this.loadRawInstanceState(instanceName) as any

        if(rawState.version != "1") {
            throw new Error(`Unknown state version '${rawState.version}'`)
        }

        // parse state to make sure it's valid
        const parser = new AnonymousStateParser()
        return parser.parse(rawState)
    }
}