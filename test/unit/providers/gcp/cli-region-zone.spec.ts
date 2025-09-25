import * as assert from 'assert';
import sinon from 'sinon';
import { GcpInputPrompter } from '../../../../src/providers/gcp/cli';
import { getUnitTestCoreConfig } from '../../utils';

// Minimal shapes for stubbing
type Region = { name?: string | null; description?: string | null };
type MachineType = { name?: string | null; guestCpus?: number | null; memoryMb?: number | null };
type AcceleratorType = { name?: string | null };

type RegionClient = {
	listRegions: (prefix?: string) => Promise<Region[]>;
	listRegionZones: (regionName: string) => Promise<string[]>;
	listMachineTypes: (zone: string) => Promise<MachineType[]>;
	listAcceleratorTypes: (zone: string) => Promise<AcceleratorType[]>;
};

type ZoneClient = {
	listRegionZones: (regionName: string) => Promise<string[]>;
	listMachineTypes: (zone: string) => Promise<MachineType[]>;
	listAcceleratorTypes: (zone: string) => Promise<AcceleratorType[]>;
};

interface GcpPrompterPrivate {
	region: (client: RegionClient, region?: string) => Promise<string>;
	zone: (client: ZoneClient, region: string, zone?: string) => Promise<string>;
}

type SelectFn = (opts: { message: string; choices: unknown; default?: unknown }) => Promise<unknown>;

describe('GCP CLI region/zone selection (cli-region-zone)', () => {
	before(function(){ this.timeout(5000); });
	const coreConfig = getUnitTestCoreConfig();

	function makePrompter(): GcpPrompterPrivate {
		return new GcpInputPrompter({ coreConfig }) as unknown as GcpPrompterPrivate; // access private methods in tests
	}

	it('region(): lists only regions with at least one gaming+GPU zone and returns selected region (emits waiting info)', async function () {
		this.timeout(5000);
		const prompter = makePrompter();
		const fakeSelect = sinon.stub();
		fakeSelect.onCall(0).resolves('europe-');
		fakeSelect.onCall(1).resolves('europe-west4');
		sinon.stub(prompter as GcpPrompterPrivate & { getSelect: () => SelectFn }, 'getSelect').returns(fakeSelect as unknown as SelectFn);

		const infoSpy = sinon.spy(console, 'info');

		const client: RegionClient = {
			listRegions: async (prefix?: string): Promise<Region[]> => {
				assert.strictEqual(prefix, 'europe-');
				return [
					{ name: 'europe-west4', description: 'Europe West 4', id: '1' },
					{ name: 'europe-west1', description: 'Europe West 1', id: '2' },
				];
			},
			listRegionZones: async (regionName: string): Promise<string[]> => {
				if (regionName === 'europe-west4') return ['europe-west4-b'];
				if (regionName === 'europe-west1') return ['europe-west1-b'];
				return [];
			},
			listMachineTypes: async (zone: string): Promise<MachineType[]> => {
				if (zone === 'europe-west4-b') return [{ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32768 }];
				return [{ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 }];
			},
			listAcceleratorTypes: async (zone: string): Promise<AcceleratorType[]> => {
				if (zone === 'europe-west4-b') return [{ name: 'nvidia-tesla-t4' }];
				return [{ name: 'nvidia-l4' }];
			},
		};

		const selectedRegion = await (prompter as GcpPrompterPrivate).region(client);
		assert.strictEqual(selectedRegion, 'europe-west4');
		assert.strictEqual(fakeSelect.callCount, 2);
		assert.ok(infoSpy.called, 'Expected console.info to be called for waiting message');
		assert.ok(infoSpy.args.some(a => /Listing available GCP regions/i.test(a.join(' '))));
		infoSpy.restore();
	});

	it('region(): throws when no eligible region is available', async function () {
		this.timeout(5000);
		const prompter = makePrompter();
		const fakeSelect = sinon.stub();
		fakeSelect.onCall(0).resolves('europe-');
		sinon.stub(prompter as GcpPrompterPrivate & { getSelect: () => SelectFn }, 'getSelect').returns(fakeSelect as unknown as SelectFn);

		const client: RegionClient = {
			listRegions: async (): Promise<Region[]> => [ { name: 'europe-west1', description: 'Europe West 1', id: '10' } ],
			listRegionZones: async (): Promise<string[]> => ['europe-west1-b'],
			listMachineTypes: async (): Promise<MachineType[]> => [ { name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 } ],
			listAcceleratorTypes: async (): Promise<AcceleratorType[]> => [{ name: 'nvidia-l4' }],
		};

		await assert.rejects(() => (prompter as GcpPrompterPrivate).region(client), /No region found/);
		assert.strictEqual(fakeSelect.callCount, 1);
	});

	it('zone(): lists only zones with gaming+GPU and returns selected zone (emits waiting info)', async function () {
		this.timeout(5000);
		const prompter = makePrompter();
		const fakeSelect = sinon.stub();
		fakeSelect.onCall(0).resolves('europe-west4-b');
		sinon.stub(prompter as GcpPrompterPrivate & { getSelect: () => SelectFn }, 'getSelect').returns(fakeSelect as unknown as SelectFn);
		const infoSpy = sinon.spy(console, 'info');

		const client: ZoneClient = {
			listRegionZones: async (regionName: string): Promise<string[]> => {
				assert.strictEqual(regionName, 'europe-west4');
				return ['europe-west4-a', 'europe-west4-b'];
			},
			listMachineTypes: async (zone: string): Promise<MachineType[]> => {
				if (zone === 'europe-west4-b') return [{ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32768 }];
				return [{ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 }];
			},
			listAcceleratorTypes: async (zone: string): Promise<AcceleratorType[]> => {
				if (zone === 'europe-west4-b') return [{ name: 'nvidia-tesla-t4' }];
				return [{ name: 'nvidia-l4' }];
			},
		};

		const selectedZone = await (prompter as GcpPrompterPrivate).zone(client, 'europe-west4');
		assert.strictEqual(selectedZone, 'europe-west4-b');
		assert.strictEqual(fakeSelect.callCount, 1);
		assert.ok(infoSpy.called, 'Expected console.info to be called for waiting message');
		assert.ok(infoSpy.args.some(a => /Listing zones in region europe-west4/i.test(a.join(' '))));
		infoSpy.restore();
	});

	it('zone(): throws when region has no eligible zones', async function () {
		this.timeout(5000);
		const client: ZoneClient = {
			listRegionZones: async (): Promise<string[]> => ['europe-west4-a'],
			listMachineTypes: async (): Promise<MachineType[]> => [ { name: 'c3-standard-8', guestCpus: 8, memoryMb: 32768 } ],
			listAcceleratorTypes: async (): Promise<AcceleratorType[]> => [{ name: 'nvidia-l4' }],
		};
		const prompter = makePrompter();
		await assert.rejects(() => prompter.zone(client, 'europe-west4'), /No zone found/);
	});

	it('zone(): throws when region has no zones at all', async function () {
		this.timeout(5000);
		const client = { listRegionZones: async (): Promise<string[]> => [] } as ZoneClient;
		const prompter = makePrompter();
		await assert.rejects(() => prompter.zone(client, 'europe-west4'), /No zones found in region europe-west4/);
	});
});

