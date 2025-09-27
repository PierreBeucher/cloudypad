import * as assert from 'assert';
import { isGamingMachineType } from '../../../../src/providers/gcp/filtering';

describe('isGamingMachineType', function () {
  it('should return true for a valid gaming machine type', function () {
    assert.strictEqual(isGamingMachineType({ name: 'n1-standard-8', guestCpus: 8, memoryMb: 32000 }), true);
    assert.strictEqual(isGamingMachineType({ name: 'g2-standard-4', guestCpus: 4, memoryMb: 16000 }), true);
  });

  it('should return false for a non-gaming family', function () {
    assert.strictEqual(isGamingMachineType({ name: 'c3-standard-8', guestCpus: 8, memoryMb: 32000 }), false);
  });

  it('should return false for insufficient CPU or RAM', function () {
    assert.strictEqual(isGamingMachineType({ name: 'n1-standard-1', guestCpus: 1, memoryMb: 16000 }), false);
    assert.strictEqual(isGamingMachineType({ name: 'n1-standard-8', guestCpus: 8, memoryMb: 512 }), false);
  });

  it('should return false for missing name', function () {
    assert.strictEqual(isGamingMachineType({ guestCpus: 8, memoryMb: 32000 }), false);
  });
});