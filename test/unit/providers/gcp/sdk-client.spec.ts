import * as assert from 'assert';
import { GcpClient } from '../../../../src/providers/gcp/sdk-client';

describe('GcpClient.listRegions', function () {
  it('should filter regions by continent prefix', async function () {
    // Mocked regions list
    const mockRegions = [
      { name: 'europe-west1' },
      { name: 'europe-west2' },
      { name: 'us-central1' },
      { name: 'asia-east1' },
      { name: 'europe-north1' },
      { name: 'us-west1' },
      { name: 'africa-south1' },
    ];
    // Mock GcpClient
    const client = new GcpClient('test', 'fake-project');

    client.regions = {
      list: async () => [mockRegions],
    } as { list: () => Promise<{ name: string }[][]> };

    const europe = await client.listRegions('europe-');
    assert.deepStrictEqual(europe.map(r => r.name), [
      'europe-west1', 'europe-west2', 'europe-north1',
    ]);

    const us = await client.listRegions('us-');
    assert.deepStrictEqual(us.map(r => r.name), [
      'us-central1', 'us-west1',
    ]);

    const asia = await client.listRegions('asia-');
    assert.deepStrictEqual(asia.map(r => r.name), ['asia-east1']);

    const africa = await client.listRegions('africa-');
    assert.deepStrictEqual(africa.map(r => r.name), ['africa-south1']);
  });
});
