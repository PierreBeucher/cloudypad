import { InstanceStateV1 } from "../state"
import { getLogger } from "../../../log/utils"
import { AnonymousStateParser } from "../parser"

/**
 * Manages side effects for States (reading, writing, listing, etc.)
 */
export abstract class StateSideEffect {

    protected logger = getLogger(StateSideEffect.name)
        
    public async persistState<ST extends InstanceStateV1>(state: ST): Promise<void> {
        const safeState = this.checkStateBeforePersist(state)
        await this.doPersistState(safeState)
    }

    /**
     * Do update state by persisting or writing state after an ultimate Zod parsing.
     * 
     * @param unsafeState state to persist
     */
    protected abstract doPersistState<ST extends InstanceStateV1>(state: ST): Promise<void>

    private checkStateBeforePersist<ST extends InstanceStateV1>(unsafeState: ST): ST{
        // Parse to make sure a buggy state isn't persisted to disk
        // Throws error if marlformed state
        const parser = new AnonymousStateParser()
        parser.parse(unsafeState)
        const safeState = unsafeState

        return safeState
    }

    /**
     * List existing instances
     */
    abstract listInstances(): string[]

    /**
     * Check if an instance exists
     */
    abstract instanceExists(instanceName: string): Promise<boolean>

    /**
     * Load raw state without parding or validation. 
     */
    abstract loadRawInstanceState(instanceName: string): Promise<unknown>

    /**
     * Destroy an instance state. This will effectively remove any state data from backend.
     */
    abstract destroyState(instanceName: string): Promise<void>
}