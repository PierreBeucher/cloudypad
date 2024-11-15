import { CommonProvisionConfigV1 } from "../../../src/core/state";

export const DEFAULT_COMMON_CONFIG: CommonProvisionConfigV1 = {
    ssh: {
        privateKeyPath: "./test/resources/ssh-key",
        user: "ubuntu"
    }
}