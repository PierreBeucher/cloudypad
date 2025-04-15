import { getLogger } from '../../log/utils'
import { AnonymousStateParser } from './parser'
import { InstanceStateV1 } from './state'
import { StateSideEffect } from './side-effects/abstract'

export interface StateLoaderArgs {
    sideEffect: StateSideEffect
}

export class StateLoader {

    private logger = getLogger(StateLoader.name)

    public readonly sideEffect: StateSideEffect

    constructor(args: StateLoaderArgs) {
        this.sideEffect = args.sideEffect
    }

    listInstances(): string[] {
        return this.sideEffect.listInstances()
    }

    /**
     * Check an instance exists. An instance is considering existing if the folder
     * ${dataRootDir}/instances/<instance_name> exists and contains a state. 
     */
    async instanceExists(instanceName: string): Promise<boolean> {
        return this.sideEffect.instanceExists(instanceName)
    }

    /**
     * Load an instance state to the latest version safely (by validating schema and throwing on error)
     * This method should be called before trying to parse the state for a provider
     */
    async loadInstanceState(instanceName: string): Promise<InstanceStateV1> {

        // read state as-is, any is acceptable at this point
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawState = await this.sideEffect.loadRawInstanceState(instanceName) as any

        if(rawState.version != "1") {
            throw new Error(`Unknown state version '${rawState.version}'`)
        }

        // parse state to make sure it's valid
        const parser = new AnonymousStateParser()
        return parser.parse(rawState)
    }
}