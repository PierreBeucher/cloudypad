import { describe, expect, test } from 'vitest'
import { pulumiOutputMapToPlainObject } from '../../src/lib/infra/pulumi/pulumi-client';
import { OutputMap } from '@pulumi/pulumi/automation';

describe('check Pulumi client functions', () => {

    test('pulumiOutputMapToPlainObject', async () => {
        
        const o: OutputMap = {
            foo: { value: "bar", secret: false },
            complex: { value: { some: "data" }, secret: false }
        }

        const result = await pulumiOutputMapToPlainObject(o)

        expect(result).toEqual({ foo: "bar", complex: { some: "data" }})
        
    });
});