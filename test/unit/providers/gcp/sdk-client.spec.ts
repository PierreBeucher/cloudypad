import * as assert from 'assert';
import { GcpClient } from '../../../../src/providers/gcp/sdk-client';

describe('GcpClient.listRegions', function () {
  it('should list all regions (no SDK-side filtering)', async function () {
    type Region = { name?: string };
    const mockRegions: Region[] = [
      { name: 'europe-west1' },
      { name: 'europe-west2' },
      { name: 'us-central1' },
      { name: 'asia-east1' },
      { name: 'europe-north1' },
      { name: 'us-west1' },
      { name: 'africa-south1' },
    ];

    class TestClient extends GcpClient {
      public override regions!: { list: () => Promise<Region[][]> };
    }

    const client = new TestClient('test', 'fake-project');
    client.regions = { list: async () => [mockRegions] };
    const all = await client.listRegions();
    assert.deepStrictEqual(all.map(r => r.name), mockRegions.map(r => r.name));
  });
});
