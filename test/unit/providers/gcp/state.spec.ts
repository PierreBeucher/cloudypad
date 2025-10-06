import { loadRawDummyStateV1 } from "../../utils";
import * as assert from "assert";
import { GcpStateParser } from "../../../../src/providers/gcp/state";
import lodash from "lodash";

describe("GcpStateParser", function () {
  const parser = new GcpStateParser();

  function hasProvisionInput(o: unknown): o is {
    provision: { input: { diskType?: string; networkTier?: string; nicType?: string } }
  } {
    if (!o || typeof o !== "object") return false;
    const prov = (o as { [k: string]: unknown })["provision"];
    if (!prov || typeof prov !== "object") return false;
    const input = (prov as { [k: string]: unknown })["input"];
    return !!input && typeof input === "object";
  }

  it("should parse a valid GCP state", function () {
    const rawState = loadRawDummyStateV1("gcp-dummy");
    const parsedState = parser.parse(rawState);

    // Build expected by cloning raw and adding parser’s defaulted fields if missing.
    // Current production defaults (align with your earlier diff):
    //   diskType: "pd-balanced"
    //   networkTier: "STANDARD"
    //   nicType: "auto"
    const expectedClone = lodash.cloneDeep(rawState);
    if (hasProvisionInput(expectedClone)) {
      expectedClone.provision.input.diskType =
        expectedClone.provision.input.diskType ?? "pd-balanced";
      expectedClone.provision.input.networkTier =
        expectedClone.provision.input.networkTier ?? "STANDARD";
      expectedClone.provision.input.nicType =
        expectedClone.provision.input.nicType ?? "auto";
    }

    assert.deepEqual(parsedState, expectedClone);
  });

  it("should throw an error for a non-GCP state", function () {
    const rawState = loadRawDummyStateV1("azure-dummy");
    assert.throws(() => {
      parser.parse(rawState);
    }, /Coulnd't parse provided State with Zod/);
  });
});
