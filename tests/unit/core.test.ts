import { describe, expect, test } from 'vitest'
import { ReplicatedEC2ManagerBox } from "../../src/boxes/aws/replicated-ec2";
import { WolfManagerBox } from "../../src/boxes/gaming/wolf";
import { NixOSManagerBox } from "../../src/boxes/nix/manager";
import { getManagerBox } from "../../src/lib/core"

const expectExamples = [
    { path: "examples/gaming/wolf-aws.yml", instanceOf: WolfManagerBox },

    { path: "examples/nixos/dns.yml", instanceOf: NixOSManagerBox },
    { path: "examples/nixos/replicated.yml", instanceOf: NixOSManagerBox },
    { path: "examples/nixos/simple.yml", instanceOf: NixOSManagerBox },

    { path: "examples/aws/ec2-replicated-instance.yml", instanceOf: ReplicatedEC2ManagerBox },
    { path: "examples/aws/ec2-single-instance.yml", instanceOf: ReplicatedEC2ManagerBox },
]

describe('load box manager for examples', () => {

    test('check box config parsing and manager types', async () => {
        
        for(const example of expectExamples){
            const bm = await getManagerBox(example.path)
            expect(bm).toBeInstanceOf(example.instanceOf)
        }
        
    });
});