import { InteractiveInstanceInitializer } from "../../cli/initializer"
import { CloudypadClient } from "../../core/client"
import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_DUMMY } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { CommonConfigurationInputV1 } from "../../core/state/state"
import { InstanceUpdater } from "../../core/updater"
import { DummyCreateCliArgs, DummyInputPrompter } from "./cli"
import { DummyInstanceStateV1, DummyProvisionInputV1, DummyStateParser } from "./state"

export type DummyProviderClientArgs = {
    coreConfig: CoreConfig
}

export class DummyProviderClient {

    private readonly args: DummyProviderClientArgs
    private coreClient: CloudypadClient

    constructor(args: DummyProviderClientArgs) {
        this.args = args
        this.coreClient = new CloudypadClient({
            config: this.args.coreConfig
        })
    }

    getInstanceInitializer(): InstanceInitializer<DummyProvisionInputV1, CommonConfigurationInputV1> {
        const initializer: InstanceInitializer<DummyProvisionInputV1, CommonConfigurationInputV1> = 
            this.coreClient.buildInstanceInitializer(CLOUDYPAD_PROVIDER_DUMMY)
        return initializer
    }
 
    getInteractiveInstanceInitializer(args: { cliArgs: DummyCreateCliArgs })
        : InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1> 
    {
        return new InteractiveInstanceInitializer<DummyCreateCliArgs, DummyProvisionInputV1, CommonConfigurationInputV1>({ 
            coreClient: this.coreClient,
            inputPrompter: new DummyInputPrompter({ coreClient: this.coreClient }),
            provider: CLOUDYPAD_PROVIDER_DUMMY,
            initArgs: args.cliArgs
        })
    }

    getInstanceUpdater(): InstanceUpdater<DummyInstanceStateV1> {
        const instanceUpdater = this.coreClient.buildInstanceUpdater(new DummyStateParser())
        return instanceUpdater
    }

    async getInstanceState(instanceName: string): Promise<DummyInstanceStateV1> {
        const loader = this.coreClient.buildStateLoader()
        const parser = new DummyStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }
}