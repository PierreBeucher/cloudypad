import { AbstractInstanceRunner } from '../../core/runner';
import { StateManager } from '../../core/state';
import { GcpClient } from '../../tools/gcp';

export class GcpInstanceRunner extends AbstractInstanceRunner {

    private gcpClient: GcpClient

    constructor(sm: StateManager) {
        super(sm)

        const state = sm.get()

        if(!state.provider?.gcp) {
            throw new Error(`Invalid state: provider must be gcp, got state ${state}`)
        }

        if(!state.provider?.gcp?.provisionArgs?.create?.projectId) {
            throw new Error(`Invalid state: projectId must be set, got state ${state}`)
        }

        if(!state.provider?.gcp?.provisionArgs?.create?.zone) {
            throw new Error(`Invalid state: zone must be set, got state ${state}`)
        }

        if(!state.provider?.gcp?.instanceName) {
            throw new Error(`Invalid state: instanceName must be set, got state ${state}`)
        }

        this.gcpClient = new GcpClient(sm.name(), state.provider.gcp.provisionArgs.create?.projectId)
    }

    private getinstanceName(): string{
        const n = this.stateManager.get().provider?.gcp?.instanceName
        if(!n){
            throw new Error("Couldn't perform operation: unknown instance name in state.")
        }

        return n
    }

    private getZone(): string{
        const z = this.stateManager.get().provider?.gcp?.provisionArgs?.create.zone
        if(!z){
            throw new Error("Couldn't perform operation: unknown zone in state.")
        }
        return z        
    }

    async start() {
        await super.start()
        this.gcpClient.startInstance(this.getZone(), this.getinstanceName())
    }

    async stop() {
        await super.stop()
        this.gcpClient.stopInstance(this.getZone(), this.getinstanceName())
    }

    async restart() {
        await super.restart()
        this.gcpClient.restartInstance(this.getZone(), this.getinstanceName())
    }
}
