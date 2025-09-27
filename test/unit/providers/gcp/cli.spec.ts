import * as assert from 'assert';
import { GcpInstanceInput } from '../../../../src/providers/gcp/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const';
import {
  DEFAULT_COMMON_CLI_ARGS,
  DEFAULT_COMMON_INPUT,
  getUnitTestCoreConfig,
} from '../../utils';
import { GcpCreateCliArgs, GcpInputPrompter } from '../../../../src/providers/gcp/cli';
import lodash from 'lodash';
import { PartialDeep } from 'type-fest';
import type { CommonInstanceInput } from '../../../../src/core/state/state';
import type { PromptOptions } from '../../../../src/cli/prompter';

describe('GCP input prompter', () => {
  const instanceName = 'gcp-dummy';
  const coreConfig = getUnitTestCoreConfig();

  // Full input (what a user would provide when skipping prompts)
  // Includes the new literal-union fields: diskType, networkTier, nicType.
  // IMPORTANT: runtime full pass-through yields [[null]] for wolf.
  const TEST_INPUT: GcpInstanceInput = {
    instanceName,
    provision: {
      ...DEFAULT_COMMON_INPUT.provision,
      machineType: 'n1-standard-8',
      diskSize: 200,
      diskType: 'pd-balanced',
      networkTier: 'PREMIUM',
      nicType: 'auto',
      publicIpType: PUBLIC_IP_TYPE_STATIC,
      region: 'europe-west4',
      zone: 'europe-west4-b',
      acceleratorType: 'nvidia-tesla-p4',
      projectId: 'crafteo-sandbox',
      useSpot: true,
      costAlert: {
        notificationEmail: 'test@test.com',
        limit: 100,
      },
    },
    configuration: {
      ...DEFAULT_COMMON_INPUT.configuration,
      // full input case shape
      wolf: [null],
    },
  };

  /**
   * CLI args that should NOT trigger interactive prompts in cliArgsIntoPartialInput.
   * We also pass the new enum-like fields so conversion can narrow them to the correct unions.
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
    // New fields passed as strings; prod code narrows them to unions.
    diskType: TEST_INPUT.provision.diskType,
    networkTier: TEST_INPUT.provision.networkTier,
    nicType: TEST_INPUT.provision.nicType,
  };

  it('should convert CLI args into partial input (with new types)', () => {
    const prompter = new GcpInputPrompter({ coreConfig });
    const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS);

    // Expected partial: ssh.user omitted and wolf matches partial shape [[undefined]]
    const expected: PartialDeep<GcpInstanceInput> = {
      ...TEST_INPUT,
      provision: {
        ...TEST_INPUT.provision,
        ssh: lodash.omit(TEST_INPUT.provision.ssh, 'user'),
      },
      configuration: {
        ...TEST_INPUT.configuration,
        wolf: null,
      },
    };

    assert.deepEqual(result, expected);
  });

  it('should return provided inputs without prompting when full input is provided', async () => {
    const prompter = new GcpInputPrompter({ coreConfig });

    // Type-safe monkey-patch of the protected method (no `any`).
    type PromptSpecificInputMethod = (
      commonInput: CommonInstanceInput,
      partialInput: PartialDeep<GcpInstanceInput>,
      createOptions: PromptOptions
    ) => Promise<GcpInstanceInput>;

    const prompterWithPatch = prompter as unknown as {
      promptSpecificInput: PromptSpecificInputMethod;
    };

    prompterWithPatch.promptSpecificInput = async () => {
      // Return a deep clone of the full input to simulate pass-through
      return lodash.cloneDeep(TEST_INPUT);
    };

    const result = await prompter.promptInput(TEST_INPUT, {
      overwriteExisting: true,
      autoApprove: true,
    });

    // Direct comparison: full case already uses [[null]] in TEST_INPUT
    assert.deepEqual(result, TEST_INPUT);
  });

  it('should convert CLI args into partial input (idempotent, with new types)', () => {
    const prompter = new GcpInputPrompter({ coreConfig });
    const result = prompter.cliArgsIntoPartialInput(TEST_CLI_ARGS);

    const expected: PartialDeep<GcpInstanceInput> = {
      ...TEST_INPUT,
      provision: {
        ...TEST_INPUT.provision,
        ssh: lodash.omit(TEST_INPUT.provision.ssh, 'user'),
      },
      configuration: {
        ...TEST_INPUT.configuration,
        wolf: null,
      },
    };

    assert.deepEqual(result, expected);
  });

  it('diskType prompt should early-return when diskType already provided', async () => {
    const prompter = new GcpInputPrompter({ coreConfig }) as unknown as {
      // expose private for test via casting
      diskType: (diskType?: string) => Promise<string>
    };

    // We pass a value and expect no interactive select attempt. Since the method immediately returns
    // when diskType is truthy, we just verify the resolved value matches input.
    const value = await prompter.diskType('pd-ssd');
    assert.strictEqual(value, 'pd-ssd');
  });

  it('networkTier prompt should early-return when networkTier already provided', async () => {
    const prompter = new GcpInputPrompter({ coreConfig }) as unknown as {
      networkTier: (networkTier?: string) => Promise<string>
    };
    const value = await prompter.networkTier('STANDARD');
    assert.strictEqual(value, 'STANDARD');
  });

  it('nicType prompt should early-return when nicType already provided', async () => {
    const prompter = new GcpInputPrompter({ coreConfig }) as unknown as {
      nicType: (nicType?: string) => Promise<string>
    };
    const value = await prompter.nicType('GVNIC');
    assert.strictEqual(value, 'GVNIC');
  });

  it('networkTier invalid value should trigger prompt instead of early return', async () => {
    type PrivatePrompter = GcpInputPrompter & { getSelect: () => (o: { message: string, choices: ReadonlyArray<unknown>, default?: string }) => Promise<string> };
    const prompter = new GcpInputPrompter({ coreConfig }) as PrivatePrompter & { rawNetworkTier?: string };
    // Simulate CLI providing invalid value that got narrowed to undefined
    (prompter as { rawNetworkTier?: string }).rawNetworkTier = 'INVALID_TIER';
    let selectCalled = false;
    const fakeSelect = async () => { selectCalled = true; return 'STANDARD'; };
    prompter.getSelect = () => fakeSelect;
    const value = await (prompter as unknown as { networkTier: (v?: string) => Promise<string> }).networkTier(undefined);
    assert.strictEqual(value, 'STANDARD');
    assert.ok(selectCalled, 'Expected select to be called for invalid network tier (narrowed)');
  });

  it('nicType invalid value should trigger prompt instead of early return', async () => {
    type PrivatePrompter = GcpInputPrompter & { getSelect: () => (o: { message: string, choices: ReadonlyArray<unknown>, default?: string }) => Promise<string> };
    const prompter = new GcpInputPrompter({ coreConfig }) as PrivatePrompter & { rawNicType?: string };
    (prompter as { rawNicType?: string }).rawNicType = 'BAD_NIC';
    let selectCalled = false;
    const fakeSelect = async () => { selectCalled = true; return 'auto'; };
    prompter.getSelect = () => fakeSelect;
    const value = await (prompter as unknown as { nicType: (v?: string) => Promise<string> }).nicType(undefined);
    assert.strictEqual(value, 'auto');
    assert.ok(selectCalled, 'Expected select to be called for invalid nic type (narrowed)');
  });

  it('diskType invalid value should trigger prompt instead of early return', async () => {
    type PrivatePrompter = GcpInputPrompter & { getSelect: () => (o: { message: string, choices: ReadonlyArray<unknown>, default?: string }) => Promise<string> };
    const prompter = new GcpInputPrompter({ coreConfig }) as PrivatePrompter & { rawDiskType?: string };
    (prompter as { rawDiskType?: string }).rawDiskType = 'BAD_DISK';
    let selectCalled = false;
    const fakeSelect = async () => { selectCalled = true; return 'pd-balanced'; };
    prompter.getSelect = () => fakeSelect;
    const mockClient = { listDiskTypes: async () => ['pd-standard', 'pd-balanced', 'pd-ssd'] } as unknown;
    const value = await (prompter as unknown as { diskType: (v?: string, c?: unknown, z?: string) => Promise<string> }).diskType(undefined, mockClient, 'europe-west4-b');
    assert.strictEqual(value, 'pd-balanced');
    assert.ok(selectCalled, 'Expected select to be called for invalid disk type (narrowed)');
  });
});
