import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as assert from 'assert';
import { fetchApiKeyFromEnvironment } from '../../src/providers/paperspace/client/client';

describe('fetchApiKeyFromEnvironment should find keys', () => {

    const scenarios = [
        {
            description: 'should load all 3 keys from the temporary credentials.toml file',
            credentialsContent: `
                version = 1

                [keys]
                team1 = "key1"
                team2 = "key2"
                team3 = "key3"
            `,
            expected: ['key1', 'key2', 'key3']
        },
        {
            description: 'should load single key from the temporary credentials.toml file',
            credentialsContent: `
                version = 1

                [keys]
                team1 = "key4"
            `,
            expected: ['key4']
        },
        {
            description: 'should load no key from the temporary credentials.toml file',
            credentialsContent: `
                version = 1
            `,
            expected: []
        }
    ];

    scenarios.forEach(({ description, credentialsContent, expected }) => {
        it(description, () => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudypad-test-'));
            const paperspaceHome = path.join(tempDir, '.paperspace'); // Override home for test

            const credentialsFilePath = path.join(paperspaceHome, 'credentials.toml');

            fs.mkdirSync(paperspaceHome);
            fs.writeFileSync(credentialsFilePath, credentialsContent);

            const apiKeys = fetchApiKeyFromEnvironment(paperspaceHome);
            assert.deepEqual(apiKeys, expected);
        });
    });
});
