import { CommonProvisionInputV1 } from "../../../src/core/state/state";

export const DEFAULT_COMMON_INPUT: CommonProvisionInputV1 = {
    ssh: {
        privateKeyPath: "./test/resources/ssh-key",
        user: "ubuntu"
    }
}