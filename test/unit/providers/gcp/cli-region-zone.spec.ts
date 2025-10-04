import * as assert from 'assert';
import sinon from 'sinon';
import { GcpInputPrompter, type GcpApi } from '../../../../src/providers/gcp/cli';
import { DEFAULT_DISK_TYPE, DEFAULT_NETWORK_TIER, DEFAULT_NIC_TYPE } from '../../../../src/providers/gcp/const';
import { PUBLIC_IP_TYPE_STATIC } from '../../../../src/core/const';
import { CommonInstanceInput } from '../../../../src/core/state/state';
import type { GcpInstanceInput } from '../../../../src/providers/gcp/state';
import type { PartialDeep } from 'type-fest';
import { getUnitTestCoreConfig } from '../../utils';

import type { select as InquirerSelect } from '@inquirer/prompts';
import { mkSelect, toInquirerSelect } from '../../helpers/typed-select-helpers';
const mkSelectFromStub = (stub: sinon.SinonStub): typeof InquirerSelect => toInquirerSelect(mkSelect('IGNORED', () => { stub(); }));

// Testable prompter exposing a wrapper to call the protected prompt flow and overriding getSelect
class TestPrompter extends GcpInputPrompter {
  public async run(commonInput: CommonInstanceInput, partialInput: PartialDeep<GcpInstanceInput>) {
    return await this.promptSpecificInput(commonInput, partialInput, { autoApprove: true, skipQuotaWarning: true });
  }
}

describe('GCP CLI region/zone selection (cli-region-zone)', () => {
  before(function(){ this.timeout(5000); });
  let infoSpy: sinon.SinonSpy | undefined;
  afterEach(() => { if (infoSpy) { infoSpy.restore(); infoSpy = undefined; } });
  const coreConfig = getUnitTestCoreConfig();

  function baseCommonInput(): CommonInstanceInput {
    return {
      instanceName: 'test',
      provision: { ssh: { user: 'ubuntu', privateKeyPath: '/tmp/key' } },
      configuration: {}
    };
  }
  function basePartial(): PartialDeep<GcpInstanceInput> {
    return {
      provision: {
        projectId: 'p1',
        machineType: 'n1-standard-8',
        acceleratorType: 'nvidia-tesla-t4',
        diskSize: 100,
        diskType: DEFAULT_DISK_TYPE,
        networkTier: DEFAULT_NETWORK_TIER,
        nicType: DEFAULT_NIC_TYPE,
        publicIpType: PUBLIC_IP_TYPE_STATIC,
        useSpot: false,
        costAlert: { limit: 10, notificationEmail: 'a@b.com' },
      }
    };
  }

  it('region(): lists only regions with at least one gaming+GPU zone and returns selected region (emits waiting info)', async function () {
    this.timeout(5000);
    const client: GcpApi = {
      listRegions: async () => [
        { name: 'europe-west4', description: 'Europe West 4' },
        { name: 'europe-west1', description: 'Europe West 1' },
      ],
      listRegionZones: async (regionName: string) => regionName === 'europe-west4' ? ['europe-west4-b'] : ['europe-west1-b'],
      listMachineTypes: async (zone: string) => zone === 'europe-west4-b' ? [{ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32768 }] : [{ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 }],
      listAcceleratorTypes: async (zone: string) => zone === 'europe-west4-b' ? [{ name: 'nvidia-tesla-t4' }] : [{ name: 'nvidia-l4' }],
      // not used in these tests
      listDiskTypes: async () => [],
    };

    const selectStub = sinon.stub()
      .onFirstCall().resolves('Europe')
      .onSecondCall().resolves('europe-west4')
      // zone selection
      .onThirdCall().resolves('europe-west4-b');
    const selectAdapter = mkSelectFromStub(selectStub);
    const prompter = new TestPrompter({ coreConfig, clientFactory: () => client, selectFn: selectAdapter });

    infoSpy = sinon.spy(console, 'info');

    const result = await prompter.run(baseCommonInput(), basePartial());
    assert.strictEqual(result.provision.region, 'europe-west4');
    assert.strictEqual(selectStub.callCount, 3);
    assert.ok(infoSpy.called, 'Expected console.info to be called for waiting message');
    assert.ok(infoSpy.args.some(a => /Listing available GCP regions/i.test(a.join(' '))));
  });

  it('region(): throws when no eligible region is available', async function () {
    this.timeout(5000);
    const client: GcpApi = {
      listRegions: async () => [ { name: 'europe-west1', description: 'Europe West 1' } ],
      listRegionZones: async () => ['europe-west1-b'],
      listMachineTypes: async () => [ { name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 } ],
      listAcceleratorTypes: async () => [{ name: 'nvidia-l4' }],
      listDiskTypes: async () => [],
    };

    const selectStub = sinon.stub().resolves('Europe');
    const selectAdapter = mkSelectFromStub(selectStub);
    const prompter = new TestPrompter({ coreConfig, clientFactory: () => client, selectFn: selectAdapter });

    await assert.rejects(() => prompter.run(baseCommonInput(), basePartial()), /No region found/);
    assert.strictEqual(selectStub.callCount, 1);
  });

  it('zone(): lists only zones with gaming+GPU and returns selected zone (emits waiting info)', async function () {
    this.timeout(5000);
    const client: GcpApi = {
      listRegions: async () => [],
      listRegionZones: async (regionName: string) => {
        assert.strictEqual(regionName, 'europe-west4');
        return ['europe-west4-a', 'europe-west4-b'];
      },
      listMachineTypes: async (zone: string) => zone === 'europe-west4-b' ? [{ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32768 }] : [{ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 }],
      listAcceleratorTypes: async (zone: string) => zone === 'europe-west4-b' ? [{ name: 'nvidia-tesla-t4' }] : [{ name: 'nvidia-l4' }],
      listDiskTypes: async () => [],
    };

    const selectStub = sinon.stub().resolves('europe-west4-b');
    const selectAdapter = mkSelectFromStub(selectStub);
    const prompter = new TestPrompter({ coreConfig, clientFactory: () => client, selectFn: selectAdapter });

    infoSpy = sinon.spy(console, 'info');

    const partial = basePartial();
    const partialWithRegion: PartialDeep<GcpInstanceInput> = {
      ...partial,
      provision: {
        ...partial.provision,
        region: 'europe-west4',
      },
    };
    const result = await prompter.run(baseCommonInput(), partialWithRegion);

    assert.strictEqual(result.provision.zone, 'europe-west4-b');
    assert.strictEqual(selectStub.callCount, 1);
    assert.ok(infoSpy.called, 'Expected console.info to be called for waiting message');
    assert.ok(infoSpy.args.some(a => /Listing zones in region europe-west4/i.test(a.join(' '))));
  });

  it('zone(): throws when region has no eligible zones', async function () {
    this.timeout(5000);
    const client: GcpApi = {
      listRegions: async () => [],
      listRegionZones: async () => ['europe-west4-a'],
      listMachineTypes: async () => [ { name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 } ],
      listAcceleratorTypes: async () => [{ name: 'nvidia-l4' }],
      listDiskTypes: async () => [],
    };
    const selectStub = sinon.stub().resolves('irrelevant');
    const selectAdapter = mkSelectFromStub(selectStub);
    const prompter = new TestPrompter({ coreConfig, clientFactory: () => client, selectFn: selectAdapter });
    const partial = basePartial();
    const partialWithRegion: PartialDeep<GcpInstanceInput> = {
      ...partial,
      provision: {
        ...partial.provision,
        region: 'europe-west4',
      },
    };

    await assert.rejects(() => prompter.run(baseCommonInput(), partialWithRegion), /No zone found/);
  });

  it('zone(): throws when region has no zones at all', async function () {
    this.timeout(5000);
    const client: GcpApi = {
      listRegions: async () => [],
      listRegionZones: async () => [],
      listMachineTypes: async () => [],
      listAcceleratorTypes: async () => [],
      listDiskTypes: async () => [],
    };
    const selectStub = sinon.stub().resolves('irrelevant');
    const selectAdapter = mkSelectFromStub(selectStub);
    const prompter = new TestPrompter({ coreConfig, clientFactory: () => client, selectFn: selectAdapter });
    const partial = basePartial();
    const partialWithRegion: PartialDeep<GcpInstanceInput> = {
      ...partial,
      provision: {
        ...partial.provision,
        region: 'europe-west4',
      },
    };

    await assert.rejects(() => prompter.run(baseCommonInput(), partialWithRegion), /No zones found in region europe-west4/);
  });
});

