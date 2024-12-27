import { CommonInstanceInput } from "../../../src/core/state/state";

export const DEFAULT_COMMON_INPUT: CommonInstanceInput = {
    instanceName: "dummy-instance",
    provision: {
        ssh: {
            privateKeyPath: "./test/resources/ssh-key",
            user: "ubuntu"
        }
    },
    configuration: {}
}