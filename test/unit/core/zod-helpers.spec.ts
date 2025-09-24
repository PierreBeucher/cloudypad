import * as assert from 'assert';
import { z } from 'zod';
import { isZodEnum, isZodDefaultEnum, enumOptions, toEnumFromSchema, toEnumFromSchemaOrThrow } from '../../../src/core/zod-helpers';

describe('zod-helpers', function () {
  const ColorEnum = z.enum(['red', 'green', 'blue']);
  const DefaultColorEnum = ColorEnum.default('green');

  it('isZodEnum returns true for ZodEnum', function () {
    assert.strictEqual(isZodEnum(ColorEnum), true);
    assert.strictEqual(isZodEnum(DefaultColorEnum), false);
  });

  it('isZodDefaultEnum returns true for ZodDefault<ZodEnum>', function () {
    assert.strictEqual(isZodDefaultEnum(DefaultColorEnum), true);
    assert.strictEqual(isZodDefaultEnum(ColorEnum), false);
  });

  it('enumOptions returns enum values for ZodEnum', function () {
    assert.deepStrictEqual(enumOptions(ColorEnum), ['red', 'green', 'blue']);
  });

  it('enumOptions returns enum values for ZodDefault<ZodEnum>', function () {
    assert.deepStrictEqual(enumOptions(DefaultColorEnum), ['red', 'green', 'blue']);
  });

  it('toEnumFromSchema returns the value if valid, else undefined', function () {
    assert.strictEqual(toEnumFromSchema(ColorEnum, 'red'), 'red');
    assert.strictEqual(toEnumFromSchema(ColorEnum, 'yellow'), undefined);
    assert.strictEqual(toEnumFromSchema(DefaultColorEnum, 'blue'), 'blue');
    assert.strictEqual(toEnumFromSchema(DefaultColorEnum, 'yellow'), undefined);
  });

  it('toEnumFromSchemaOrThrow returns the value if valid, else throws', function () {
    assert.strictEqual(toEnumFromSchemaOrThrow(ColorEnum, 'green'), 'green');
    assert.throws(() => toEnumFromSchemaOrThrow(ColorEnum, 'yellow'), /Invalid value/);
  });
});
