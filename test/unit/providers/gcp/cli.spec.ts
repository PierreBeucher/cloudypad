import * as assert from 'assert';
import { GcpInstanceInput } from '../../../../src/providers/gcp/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const';
import { DEFAULT_COMMON_CLI_ARGS, DEFAULT_COMMON_INPUT, getUnitTestCoreClient, getUnitTestCoreConfig } from '../../utils';
import { GcpCreateCliArgs, GcpInputPrompter, isGamingMachineType } from '../../../../src/providers/gcp/cli';
import lodash from 'lodash'
import { PartialDeep } from 'type-fest';
import { DISK_TYPE_SSD, NETWORK_TIER_PREMIUM, NIC_TYPE_AUTO } from '../../../../src/providers/gcp/const';

describe('GCP input prompter', () => {

    const instanceName = "gcp-dummy"
    const coreConfig = getUnitTestCoreConfig()

    const TEST_INPUT: GcpInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            machineType: "n1-standard-8",
            diskSize: 200,
            publicIpType: PUBLIC_IP_TYPE_STATIC,
            region: "europe-west4",
            zone: "europe-west4-b",
            acceleratorType: "nvidia-tesla-p4",
            projectId: "crafteo-sandbox",
            useSpot: true,
            costAlert: {
                notificationEmail: "test@test.com",
                limit: 100
            },
            diskType: DISK_TYPE_SSD,
            networkTier: NETWORK_TIER_PREMIUM,
            nicType: NIC_TYPE_AUTO,
            dataDiskSizeGb: 100,
            baseImageSnapshot: {
                enable: true,
                keepOnDeletion: true,
            },
            dataDiskSnapshot: {
                enable: true,
            },
            deleteInstanceServerOnStop: true,
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        },
    }

    /**
     * CLI args that should not trigger interactive input
     */
    const TEST_CLI_ARGS: GcpCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: instanceName,
        projectId: TEST_INPUT.provision.projectId,
        region: TEST_INPUT.provision.region,
        zone: TEST_INPUT.provision.zone,
        machineType: TEST_INPUT.provision.machineType,
        diskSize: TEST_INPUT.provision.diskSize,
        publicIpType: TEST_INPUT.provision.publicIpType,
        gpuType: TEST_INPUT.provision.acceleratorType,
        spot: TEST_INPUT.provision.useSpot,
        costNotificationEmail: TEST_INPUT.provision.costAlert?.notificationEmail,
        costLimit: TEST_INPUT.provision.costAlert?.limit,
        diskType: TEST_INPUT.provision.diskType,
        networkTier: TEST_INPUT.provision.networkTier,
        nicType: TEST_INPUT.provision.nicType,
        baseImageSnapshotEnable: TEST_INPUT.provision.baseImageSnapshot?.enable,
        keepBaseImageOnDeletion: TEST_INPUT.provision.baseImageSnapshot?.keepOnDeletion,
        dataDiskSnapshotEnable: TEST_INPUT.provision.dataDiskSnapshot?.enable,
        deleteInstanceServerOnStop: TEST_INPUT.provision.deleteInstanceServerOnStop,
        dataDiskSize: TEST_INPUT.provision.dataDiskSizeGb,
    }

    it('should convert CLI args into partial input', () => {
        const prompter = new GcpInputPrompter({ coreConfig: coreConfig })
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<GcpInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            },
            configuration: {
                ...TEST_INPUT.configuration,
                wolf: null
            }
        }
        
        assert.deepEqual(result, expected)
    })

    it('should return provided inputs without prompting when full input provider', async () => {
        const result = await new GcpInputPrompter({ coreConfig: coreConfig }).promptInput(TEST_INPUT, { overwriteExisting: true, autoApprove: true })
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        
        const prompter = new GcpInputPrompter({ coreConfig: coreConfig })
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<GcpInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user")
            },
        }
        
        assert.deepEqual(result, expected)
    })

    it('should return true for a valid gaming machine type', function () {
      assert.strictEqual(isGamingMachineType({ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32000 }), true);
      assert.strictEqual(isGamingMachineType({ name: 'g2-standard-4', guestCpus: 4, memoryMb: 16000 }), true);
    });
  
    it('should return false for a non-gaming family', function () {
      assert.strictEqual(isGamingMachineType({ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32000 }), false);
    });
  
    it('should return false for insufficient CPU or RAM', function () {
      assert.strictEqual(isGamingMachineType({ name: 'n1-standard-1', guestCpus: 1, memoryMb: 16000 }), false);
      assert.strictEqual(isGamingMachineType({ name: 'n1-standard-8', guestCpus: 8, memoryMb: 512 }), false);
    });
  
    it('should return false for missing name', function () {
      assert.strictEqual(isGamingMachineType({ guestCpus: 8, memoryMb: 32000 }), false);
    });
})
    

