import { InteractiveInstanceInitializer } from "../cli/initializer"
import { CloudypadClient } from "./client"
import { CoreConfig } from "./config/interface"
import { InstanceInitializer } from "./initializer"
import { CommonConfigurationInputV1, InstanceStateV1 } from "./state/state"
import { InstanceUpdater } from "./updater"
import { getLogger, Logger } from "../log/utils"

export type ProviderClientArgs = {
    config: CoreConfig
}

export abstract class AbstractProviderClient<ST extends InstanceStateV1> {
    protected coreClient: CloudypadClient
    protected logger: Logger

    constructor(args: ProviderClientArgs) {
        this.coreClient = new CloudypadClient(args)
        this.logger = getLogger("AbstractProviderClient")
    }

    abstract getInstanceInitializer(): InstanceInitializer<ST["provision"]["input"], ST["configuration"]["input"]>

    abstract getInstanceUpdater(): InstanceUpdater<ST>

    abstract getInstanceState(instanceName: string): Promise<ST>
}
