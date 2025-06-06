import { InteractiveInstanceInitializer } from "../../cli/initializer"
import { CloudypadClient } from "../../core/client"
import { CLOUDYPAD_PROVIDER_SCALEWAY } from "../../core/const"
import { InstanceInitializer } from "../../core/initializer"
import { CommonConfigurationInputV1 } from "../../core/state/state"
import { StateWriter } from "../../core/state/writer"
import { InstanceUpdater } from "../../core/updater"
import { ScalewayCreateCliArgs, ScalewayInputPrompter } from "./cli"
import { ScalewayInstanceStateV1, ScalewayProvisionInputV1, ScalewayStateParser } from "./state"

export class ScalewayProviderClient {

    getInstanceInitializer(args: { coreClient: CloudypadClient }): InstanceInitializer<ScalewayProvisionInputV1, CommonConfigurationInputV1> {
        const initializer: InstanceInitializer<ScalewayProvisionInputV1, CommonConfigurationInputV1> = 
            args.coreClient.buildInstanceInitializer(CLOUDYPAD_PROVIDER_SCALEWAY)
        return initializer
    }
 
    getInteractiveInstanceInitializer(args: { coreClient: CloudypadClient, cliArgs: ScalewayCreateCliArgs })
        : InteractiveInstanceInitializer<ScalewayCreateCliArgs, ScalewayProvisionInputV1, CommonConfigurationInputV1> 
    {
        return new InteractiveInstanceInitializer<ScalewayCreateCliArgs, ScalewayProvisionInputV1, CommonConfigurationInputV1>({ 
            coreClient: args.coreClient,
            inputPrompter: new ScalewayInputPrompter({ coreClient: args.coreClient }),
            provider: CLOUDYPAD_PROVIDER_SCALEWAY,
            initArgs: args.cliArgs
        })
    }

    getInstanceUpdater(args: { coreClient: CloudypadClient }): InstanceUpdater<ScalewayInstanceStateV1> {
        const instanceUpdater = args.coreClient.buildInstanceUpdater(new ScalewayStateParser())
        return instanceUpdater
    }

    async getInstanceState(args: { instanceName: string, coreClient: CloudypadClient }): Promise<ScalewayInstanceStateV1> {
        const loader = args.coreClient.buildStateLoader()
        const parser = new ScalewayStateParser()
        const rawState = await loader.loadInstanceState(args.instanceName)
        return parser.parse(rawState)
    }

    getStateWriter(args: { state: ScalewayInstanceStateV1, coreClient: CloudypadClient }): StateWriter<ScalewayInstanceStateV1> {
        return args.coreClient.buildStateWriterFor(args.state)
    }
}