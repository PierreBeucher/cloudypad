import { InteractiveInstanceInitializer } from "../../cli/initializer"
import { CloudypadClient } from "../../core/client"
import { CoreConfig } from "../../core/config/interface"
import { CLOUDYPAD_PROVIDER_SCALEWAY } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { AbstractProviderClient } from "../../core/provider"
import { CommonConfigurationInputV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { ScalewayCreateCliArgs, ScalewayInputPrompter } from "./cli"
import { ScalewayInstanceStateV1, ScalewayProvisionInputV1, ScalewayStateParser } from "./state"

export type ScalewayProviderClientArgs = {
    config: CoreConfig
}

export class ScalewayProviderClient extends AbstractProviderClient<ScalewayInstanceStateV1> {

    constructor(args: ScalewayProviderClientArgs) {
        super(args)
    }

    getInstanceInitializer(): InstanceInitializer<ScalewayProvisionInputV1, CommonConfigurationInputV1> {
        const initializer: InstanceInitializer<ScalewayProvisionInputV1, CommonConfigurationInputV1> = 
            this.coreClient.buildInstanceInitializer(CLOUDYPAD_PROVIDER_SCALEWAY)
        return initializer
    }

    getInteractiveInstanceInitializer(cliArgs: ScalewayCreateCliArgs)
        : InteractiveInstanceInitializer<ScalewayCreateCliArgs, ScalewayProvisionInputV1, CommonConfigurationInputV1> 
    {
        return new InteractiveInstanceInitializer<ScalewayCreateCliArgs, ScalewayProvisionInputV1, CommonConfigurationInputV1>({ 
            coreClient: this.coreClient,
            inputPrompter: new ScalewayInputPrompter({ coreClient: this.coreClient }),
            provider: CLOUDYPAD_PROVIDER_SCALEWAY,
            initArgs: cliArgs
        })
    }

    getInstanceUpdater(): InstanceUpdater<ScalewayInstanceStateV1> {
        const instanceUpdater = this.coreClient.buildInstanceUpdater(new ScalewayStateParser())
        return instanceUpdater
    }

    async getInstanceState(instanceName: string): Promise<ScalewayInstanceStateV1> {
        const loader = this.coreClient.buildStateLoader()
        const parser = new ScalewayStateParser()
        const rawState = await loader.loadInstanceState(instanceName)
        return parser.parse(rawState)
    }

    getStateWriter(state: ScalewayInstanceStateV1): StateWriter<ScalewayInstanceStateV1> {
        return this.coreClient.buildStateWriterFor(state)
    }
}