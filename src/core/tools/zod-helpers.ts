import { z } from "zod";

/**
 * Type guard: returns true if `x` is a ZodEnum<[string, ...string[]]>.
 */
export function isZodEnum(x: unknown): x is z.ZodEnum<[string, ...string[]]> {
	return x instanceof z.ZodEnum;
}

/**
 * Type guard: returns true if `x` is a ZodDefault wrapping a ZodEnum.
 */
export function isZodDefaultEnum(x: unknown): x is z.ZodDefault<z.ZodEnum<[string, ...string[]]>> {
	return x instanceof z.ZodDefault
		&& ((x as z.ZodDefault<z.ZodTypeAny>)._def?.innerType instanceof z.ZodEnum);
}

/**
 * Return the enum literal values from either:
 *  - a plain ZodEnum, or
 *  - a ZodDefault<ZodEnum> (by reading its inner enum).
 */
export function enumOptions<T extends z.ZodEnum<[string, ...string[]]>>(
	schema: T | z.ZodDefault<T>
): Readonly<T["_def"]["values"]> {
	if (isZodEnum(schema)) {
		return schema.options as Readonly<T["_def"]["values"]>;
	}
	if (isZodDefaultEnum(schema)) {
		const inner = (schema as z.ZodDefault<T>)._def.innerType as T;
		return inner.options as Readonly<T["_def"]["values"]>;
	}
	throw new Error("Field is not a ZodEnum or ZodDefault<ZodEnum>.");
}

/**
 * Narrow a loose `string | undefined` to the exact union of literals defined by the schema.
 */
export function toEnumFromSchema<T extends z.ZodEnum<[string, ...string[]]>>(
	schema: T | z.ZodDefault<T>,
	value?: string
): T["_def"]["values"][number] | undefined {
	if (!value) return undefined;
	const opts = enumOptions(schema) as readonly string[];
	return opts.includes(value) ? (value as T["_def"]["values"][number]) : undefined;
}

/**
 * Strict variant of `toEnumFromSchema`:
 * - Returns a valid literal (never undefined), or
 * - Throws an error listing allowed values.
 */
export function toEnumFromSchemaOrThrow<T extends z.ZodEnum<[string, ...string[]]>>(
	schema: T | z.ZodDefault<T>,
	value: string
): T["_def"]["values"][number] {
	const v = toEnumFromSchema(schema, value);
	if (v === undefined) {
		const opts = Array.from(enumOptions(schema)).join(", ");
		throw new Error(`Invalid value "${value}". Allowed: ${opts}`);
	}
	return v;
}