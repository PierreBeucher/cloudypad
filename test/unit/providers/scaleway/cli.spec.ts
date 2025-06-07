import * as assert from 'assert';
import { ScalewayCreateCliArgs, ScalewayInputPrompter } from '../../../../src/providers/scaleway/cli';
import { DEFAULT_COMMON_CLI_ARGS, DEFAULT_COMMON_INPUT, getUnitTestCoreClient, getUnitTestCoreConfig } from '../../utils';
import { PartialDeep } from 'type-fest';
import lodash from 'lodash';
import { ScalewayInstanceInput } from '../../../../src/providers/scaleway/state';

describe('Scaleway input prompter', () => {

    const instanceName = "scaleway-dummy"
    const coreConfig = getUnitTestCoreConfig()

    const TEST_INPUT: ScalewayInstanceInput = {
        instanceName: instanceName,
        provision: {
            ...DEFAULT_COMMON_INPUT.provision,
            projectId: "99999999999999999999",
            region: "fr-par",
            zone: "fr-par-1",
            instanceType: "L4-1-24G",
            diskSizeGb: 20,
            dataDiskSizeGb: 100,
            imageId: "123e4567-e89b-12d3-a456-426614174000",
            deleteInstanceServerOnStop: true
        }, 
        configuration: {
            ...DEFAULT_COMMON_INPUT.configuration
        }
    }

    const TEST_CLI_ARGS: ScalewayCreateCliArgs = {
        ...DEFAULT_COMMON_CLI_ARGS,
        name: instanceName,
        rootDiskSize: TEST_INPUT.provision.diskSizeGb,
        dataDiskSize: TEST_INPUT.provision.dataDiskSizeGb,
        instanceType: TEST_INPUT.provision.instanceType,
        region: TEST_INPUT.provision.region,
        zone: TEST_INPUT.provision.zone,
        projectId: TEST_INPUT.provision.projectId,
        imageId: TEST_INPUT.provision.imageId,
        deleteInstanceServerOnStop: true
    }

    it('should return provided inputs without prompting when full input provider', async () => {
        const coreClient = getUnitTestCoreClient()
        const result = await new ScalewayInputPrompter({ coreConfig: coreConfig }).promptInput(TEST_INPUT, { autoApprove: true })
        assert.deepEqual(result, TEST_INPUT)
    })

    it('should convert CLI args into partial input', () => {
        const prompter = new ScalewayInputPrompter({ coreConfig: coreConfig })
        const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS)

        const expected: PartialDeep<ScalewayInstanceInput> = {
            ...TEST_INPUT,
            provision: {
                ...TEST_INPUT.provision,
                ssh: lodash.omit(TEST_INPUT.provision.ssh, "user"),
            },
            configuration: {
                ...TEST_INPUT.configuration,
                wolf: null
            }
        }
        
        assert.deepEqual(result, expected)
    })
})
