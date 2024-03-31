import { describe, expect, test } from 'vitest'
import { ReplicatedEC2BoxManager } from "../../src/boxes/aws/replicated-ec2";
import { WolfBoxManager } from "../../src/boxes/gaming/wolf";
import { ReplicatedNixOSBoxManager } from "../../src/boxes/nix/manager";
import { getBoxManager } from "../../src/lib/core"

const expectExamples = [
    { path: "examples/gaming/wolf.yml", instanceOf: WolfBoxManager },

    { path: "examples/nixos/dns.yml", instanceOf: ReplicatedNixOSBoxManager },
    { path: "examples/nixos/replicated.yml", instanceOf: ReplicatedNixOSBoxManager },
    { path: "examples/nixos/simple.yml", instanceOf: ReplicatedNixOSBoxManager },

    { path: "examples/aws/ec2-replicated-instance.yml", instanceOf: ReplicatedEC2BoxManager },
    { path: "examples/aws/ec2-single-instance.yml", instanceOf: ReplicatedEC2BoxManager },
]

describe('load box manager for examples', () => {

    test('check box config parsing and manager types', async () => {
        
        for(const example of expectExamples){
            const bm = await getBoxManager(example.path)
            expect(bm).toBeInstanceOf(example.instanceOf)
        }
        
    });
});