import { loadRawDummyStateV1 } from "../../utils";
import * as assert from "assert";
import { GcpStateParser } from "../../../../src/providers/gcp/state";
import lodash from "lodash";

describe("GcpStateParser", function () {
  const parser = new GcpStateParser();

  it("should parse a valid GCP state", function () {
    const rawState = loadRawDummyStateV1("gcp-dummy");
    const parsedState = parser.parse(rawState);

    // Build expected by cloning raw and adding parser’s defaulted fields if missing.
    // Current production defaults (align with your earlier diff):
    //   diskType: "pd-balanced"
    //   networkTier: "STANDARD"
    //   nicType: "auto"
    const expected = lodash.cloneDeep(rawState);

    const hasProvisionInput =
      expected &&
      expected.provision &&
      expected.provision.input &&
      typeof expected.provision.input === "object";

    if (hasProvisionInput) {
      expected.provision.input.diskType =
        expected.provision.input.diskType ?? "pd-balanced";
      expected.provision.input.networkTier =
        expected.provision.input.networkTier ?? "STANDARD";
      expected.provision.input.nicType =
        expected.provision.input.nicType ?? "auto";
    }

    assert.deepEqual(parsedState, expected);
  });

  it("should throw an error for a non-GCP state", function () {
    const rawState = loadRawDummyStateV1("azure-dummy");
    assert.throws(() => {
      parser.parse(rawState);
    }, /Coulnd't parse provided State with Zod/);
  });
});
