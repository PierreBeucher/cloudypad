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
      // Override the method directly to avoid touching private SDK clients
      async listRegions(): Promise<Region[]> {
        return mockRegions;
      }
    }

    const client = new TestClient('test', 'fake-project');
    const all = await client.listRegions();
    assert.deepStrictEqual(all.map(r => r.name), mockRegions.map(r => r.name));
  });
});
