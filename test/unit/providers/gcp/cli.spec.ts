import * as assert from 'assert';
import { GcpInstanceInput } from '../../../../src/providers/gcp/state';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const';
import {
  DEFAULT_COMMON_CLI_ARGS,
  DEFAULT_COMMON_INPUT,
  getUnitTestCoreConfig,
} from '../../utils';
import { GcpCreateCliArgs, GcpInputPrompter, type GcpApi } from '../../../../src/providers/gcp/cli';
import lodash from 'lodash';
import { PartialDeep } from 'type-fest';
import type { CommonInstanceInput } from '../../../../src/core/state/state';
import type { select as InquirerSelect } from '@inquirer/prompts';

describe('GCP input prompter', () => {
  // Helper to build a typed select adapter compatible with @inquirer/prompts.select
  type SelectParam = Parameters<typeof InquirerSelect>[0];
  type SelectLike = typeof InquirerSelect & { cancel?: (opts: SelectParam) => Promise<unknown> };
  function mkSelect<T>(value: T, onCall?: (opts: SelectParam) => void): typeof InquirerSelect {
    const selectLike: SelectLike = ((opts: SelectParam) => {
      onCall?.(opts);
      return Promise.resolve(value);
    }) as SelectLike;
    // Some versions expose a cancel helper; provide a no-op that matches the shape
    selectLike.cancel = (opts: SelectParam) => {
      onCall?.(opts);
      return Promise.resolve(value);
    };
    return selectLike;
  }

  // Minimal test prompter to access the protected provider-specific flow without exposing privates
  class TestPrompter extends GcpInputPrompter {
    public async run(commonInput: CommonInstanceInput, partialInput: PartialDeep<GcpInstanceInput>) {
      return await this["promptSpecificInput"](commonInput, partialInput, { autoApprove: true, skipQuotaWarning: true })
    }
  }
  const instanceName = 'gcp-dummy';
  const coreConfig = getUnitTestCoreConfig();

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
      wolf: null,
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

    // Expected partial: ssh.user omitted and wolf matches partial shape null
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
    let selectCalls = 0;
    const selectFn = mkSelect('ignored' as const, () => { selectCalls++; });
    const prompter = new GcpInputPrompter({ coreConfig, selectFn });

    // Provide a truly "full" input to bypass both common and provider-specific prompts
    const fullInput: GcpInstanceInput = lodash.cloneDeep({
      ...TEST_INPUT,
      configuration: {
        ...TEST_INPUT.configuration,
        // Ensure only one streaming server is enabled to avoid conflict
        sunshine: null,
        // Ensure streaming server is already chosen so no select occurs in common flow
        wolf: { enable: true },
        // Ensure autostop choices are present to avoid prompts
        autostop: { enable: true, timeoutSeconds: 900 },
      },
    });

    const result = await prompter.promptInput(fullInput, {
      overwriteExisting: true,
      autoApprove: true,
    });

    assert.deepEqual(result, fullInput);
    // Provider-specific selects should not be called since all provider fields are present
    assert.strictEqual(selectCalls, 0, 'Expected no provider-specific select prompts');
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
    let selectCalled = 0;
    const selectFn = mkSelect('ignored' as const, () => { selectCalled++; });
    const prompter = new TestPrompter({ coreConfig, selectFn });
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const partial: PartialDeep<GcpInstanceInput> = {
      provision: {
        projectId: 'p1', region: 'r', zone: 'z',
        machineType: 'n1-standard-8', acceleratorType: 'nvidia-tesla-t4',
        diskSize: 100,
        diskType: 'pd-ssd', // target of this test: should bypass select
        networkTier: 'PREMIUM', nicType: 'auto',
        publicIpType: PUBLIC_IP_TYPE_STATIC, useSpot: true,
        costAlert: { limit: 10, notificationEmail: 'a@b.com' },
      }
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.diskType, 'pd-ssd');
    assert.strictEqual(selectCalled, 0, 'select should not be called when diskType is provided');
  });

  it('networkTier prompt should early-return when networkTier already provided', async () => {
    let selectCalled = 0;
    const selectFn = mkSelect('ignored' as const, () => { selectCalled++; });
    const prompter = new TestPrompter({ coreConfig, selectFn });
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const partial: PartialDeep<GcpInstanceInput> = {
      provision: {
        projectId: 'p1', region: 'r', zone: 'z',
        machineType: 'n1-standard-8', acceleratorType: 'nvidia-tesla-t4',
        diskSize: 100,
        diskType: 'pd-balanced',
        networkTier: 'STANDARD', // should bypass select
        nicType: 'auto',
        publicIpType: PUBLIC_IP_TYPE_STATIC, useSpot: true,
        costAlert: { limit: 10, notificationEmail: 'a@b.com' },
      }
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.networkTier, 'STANDARD');
    assert.strictEqual(selectCalled, 0, 'select should not be called when networkTier is provided');
  });

  it('nicType prompt should early-return when nicType already provided', async () => {
    let selectCalled = 0;
    const selectFn = mkSelect('ignored' as const, () => { selectCalled++; });
    const prompter = new TestPrompter({ coreConfig, selectFn });
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const partial: PartialDeep<GcpInstanceInput> = {
      provision: {
        projectId: 'p1', region: 'r', zone: 'z',
        machineType: 'n1-standard-8', acceleratorType: 'nvidia-tesla-t4',
        diskSize: 100,
        diskType: 'pd-balanced',
        networkTier: 'PREMIUM',
        nicType: 'GVNIC', // should bypass select
        publicIpType: PUBLIC_IP_TYPE_STATIC, useSpot: true,
        costAlert: { limit: 10, notificationEmail: 'a@b.com' },
      }
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.nicType, 'GVNIC');
    assert.strictEqual(selectCalled, 0, 'select should not be called when nicType is provided');
  });

  it('networkTier invalid value should trigger prompt instead of early return', async () => {
    let selectCalled = 0;
    const selectFn = mkSelect('STANDARD' as const, () => { selectCalled++; });
    const prompter = new TestPrompter({ coreConfig, selectFn });
    // Capture raw invalid value through the CLI narrowing path
    const partial = prompter["buildProvisionerInputFromCliArgs"]({
      ...TEST_CLI_ARGS,
      networkTier: 'INVALID_TIER',
    } as GcpCreateCliArgs) as PartialDeep<GcpInstanceInput>;
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.networkTier, 'STANDARD');
    assert.ok(selectCalled > 0, 'Expected select to be called for invalid network tier (narrowed)');
  });

  it('nicType invalid value should trigger prompt instead of early return', async () => {
    let selectCalled = 0;
    const selectFn = mkSelect('auto' as const, () => { selectCalled++; });
    const prompter = new TestPrompter({ coreConfig, selectFn });
    const partial = prompter["buildProvisionerInputFromCliArgs"]({
      ...TEST_CLI_ARGS,
      nicType: 'BAD_NIC',
    } as GcpCreateCliArgs) as PartialDeep<GcpInstanceInput>;
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.nicType, 'auto');
    assert.ok(selectCalled > 0, 'Expected select to be called for invalid nic type (narrowed)');
  });

  it('diskType invalid value should trigger prompt instead of early return', async () => {
    let selectCalled = 0;
    const selectFn = mkSelect('pd-balanced' as const, () => { selectCalled++; });
    const client: GcpApi = {
      listRegions: async () => [],
      listRegionZones: async () => [],
      listMachineTypes: async () => [],
      listAcceleratorTypes: async () => [],
      listDiskTypes: async () => ['pd-standard', 'pd-balanced', 'pd-ssd'],
    };
    const prompter = new TestPrompter({ coreConfig, selectFn, clientFactory: () => client });
    const partial = prompter["buildProvisionerInputFromCliArgs"]({
      ...TEST_CLI_ARGS,
      diskType: 'BAD_DISK',
    } as GcpCreateCliArgs) as PartialDeep<GcpInstanceInput>;
    // Ensure region/zone exist for the diskType prompt path to be able to call listDiskTypes
    partial.provision = {
      ...partial.provision,
      projectId: 'p1', region: 'r', zone: 'z',
      machineType: 'n1-standard-8', acceleratorType: 'nvidia-tesla-t4',
      diskSize: 100,
      networkTier: 'PREMIUM', nicType: 'auto',
      publicIpType: PUBLIC_IP_TYPE_STATIC, useSpot: true,
      costAlert: { limit: 10, notificationEmail: 'a@b.com' },
    } as PartialDeep<GcpInstanceInput>["provision"];
    const common: CommonInstanceInput = {
      instanceName,
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {},
    };
    const result = await prompter.run(common, partial);
    assert.strictEqual(result.provision.diskType, 'pd-balanced');
    assert.ok(selectCalled > 0, 'Expected select to be called for invalid disk type (narrowed)');
  });
});
