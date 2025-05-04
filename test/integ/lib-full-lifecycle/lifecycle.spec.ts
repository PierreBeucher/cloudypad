// test the entire application lifecycle via library functions
// 1. Initialize an instance
// 2. Pair instance with Moonlight
// 3. Get instance status and details
// 4. Start the instance
// 5. Stop the instance
// 6. Destroy the instanceg

import { CLOUDYPAD_PROVIDER_AWS, PUBLIC_IP_TYPE_STATIC } from "../../../src/core/const"
import * as assert from 'assert'
import * as child_process from 'node:child_process'
import { InteractiveInstanceInitializer } from "../../../src/cli/initializer"
import { AwsCreateCliArgs, AwsInputPrompter } from "../../../src/providers/aws/cli"
import { STREAMING_SERVER_SUNSHINE } from "../../../src/cli/prompter"
import { InstanceRunningStatus } from "../../../src/core/runner"
import { makePin } from "../../../src/core/moonlight/pairer/abstract"
import { CommonConfigurationInputV1 } from "../../../src/core/state/state"
import { AwsProvisionInputV1 } from "../../../src/providers/aws/state"
import { getUnitTestCoreClient } from "../../unit/utils"


describe('Lib full lifecycle', () => {

    const instanceName = "cloudypad-test-instance"

    function getInstanceManager(instanceName: string){
        return getUnitTestCoreClient().buildInstanceManager(instanceName)
    }

    it('should initialize an instance', async () => {

        const coreClient = getUnitTestCoreClient()

        // Should be a non-interactive initializer
        await new InteractiveInstanceInitializer<AwsCreateCliArgs, AwsProvisionInputV1, CommonConfigurationInputV1>({ 
            coreClient: coreClient,
            inputPrompter: new AwsInputPrompter({ coreClient: coreClient }),
            provider: CLOUDYPAD_PROVIDER_AWS,
            initArgs: {
                name: instanceName,
                region: "eu-central-1",
                instanceType: "g4dn.xlarge",
                costAlert: false,
                diskSize: 30,
                privateSshKey: "/home/pbeucher/.ssh/id_ed25519",
                publicIpType: PUBLIC_IP_TYPE_STATIC,
                spot: false,
                overwriteExisting: true,
                streamingServer: STREAMING_SERVER_SUNSHINE,
                sunshineUser: "sunshine",
                sunshinePassword: "S3nshine!",
                skipPairing: true,
                yes: true
            }
        }).initializeInteractive()
    }).timeout(360000)

    it('should get instance details', async () => {
        const manager = await getInstanceManager(instanceName)
        const instanceDetails = await manager.getInstanceDetails()
        assert.equal(instanceDetails.name, instanceName)
        assert.equal(instanceDetails.status, InstanceRunningStatus.Running)
    })

    it('should stop instance', async () => {
        const manager = await getInstanceManager(instanceName)
        await manager.stop({ wait: true, waitTimeoutSeconds: 10*60 })
        const instanceDetails = await manager.getInstanceDetails()
        assert.equal(instanceDetails.name, instanceName)
        assert.equal(instanceDetails.status, InstanceRunningStatus.Stopped)
    }).timeout(360000) // AWS is slow to stop

    it('should start instance', async () => {
        const manager = await getInstanceManager(instanceName)
        await manager.start({ wait: true, waitTimeoutSeconds: 10*60 })
        const instanceDetails = await manager.getInstanceDetails()
        assert.equal(instanceDetails.name, instanceName)
        assert.equal(instanceDetails.status, InstanceRunningStatus.Running)
    }).timeout(120000)

    it('should pair instance with Moonlight', async () => {
        const pin = makePin()
        const manager = await getInstanceManager(instanceName)
        const hostname = (await manager.getInstanceDetails()).hostname

        console.info(`Running command: flatpak run com.moonlight_stream.Moonlight pair ${hostname} --pin ${pin}`)

        const moonlightPairCommand = `flatpak run com.moonlight_stream.Moonlight pair ${hostname} --pin ${pin}`
        const moonlightPairProcess = child_process.exec(moonlightPairCommand)
        
        moonlightPairProcess.stdout?.on('data', (data) => {
            console.log(`moonlight pair stdout: ${data}`)
        })
        moonlightPairProcess.stderr?.on('data', (data) => {
            console.error(`moonlight pair stderr: ${data}`)
        })

        await manager.pairSendPin(pin)
    }).timeout(10000)

    it('should destroy instance', async () => {
        const manager = await getInstanceManager(instanceName)
        await manager.destroy()
    }).timeout(360000)
})
