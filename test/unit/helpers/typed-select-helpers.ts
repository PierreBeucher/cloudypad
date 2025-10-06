// typed-select-helpers.ts
// -----------------------------------------------------------------------------
// Purpose
// - Provide a strongly typed "select" abstraction for tests and adapters.
// - Offer a safe adapter from a generic SelectLike<T> to the shape of
//   `@inquirer/prompts` `select`, without unsafe casts or broken inference.
//
// Key ideas
// - Derive the *effective value type* expected by Inquirer from its `choices`.
// - Constrain generics so we compare values in the same type space (no double casts).
// - Use focused type guards instead of wide casts.
// - Keep "cancel" semantics available both on the callable function and
//   the returned promise (broad compatibility for different call sites).
// -----------------------------------------------------------------------------

import type { select as InquirerSelect } from '@inquirer/prompts';

// -----------------------------------------------------------------------------
// Core "select" contract used by tests and adapters
// -----------------------------------------------------------------------------

export type SelectParam<T = unknown> = {
    message?: string;
    choices?: readonly T[]; // Optional, but when present helps decision logic
};

export type SelectLike<T> =
    ((opts: SelectParam<T>) => Promise<T>) & {
        cancel?: (opts: SelectParam<T>) => Promise<void>;
    };

// Simple test helper: make a SelectLike<T> that always returns `value` and
// triggers `onCall` when invoked/cancelled (useful for call counting).
export function mkSelect<T>(value: T, onCall?: (opts: SelectParam<T>) => void): SelectLike<T> {
    const core = async (opts: SelectParam<T>) => {
        onCall?.(opts);
        return value;
    };
    const cancel = async (opts: SelectParam<T>) => {
        onCall?.(opts);
    };
    return Object.assign(core, { cancel });
}

// -----------------------------------------------------------------------------
// Inquirer-derived types
// - We infer Inquirer `select` parameter type, the choice element type,
//   and the *effective* value type that a choice yields.
// -----------------------------------------------------------------------------

type InqParams = Parameters<typeof InquirerSelect>[0];

// Element type of the `choices` array (if present), otherwise `unknown`.
type InqChoice = InqParams extends { choices: readonly (infer C)[] } ? C : unknown;

// Given a choice element type C, infer the "value" it represents.
// - If choice is `{ value: V }`, the effective value is V.
// - If choice is a scalar (`string` | `number`), the value is the scalar itself.
// - Otherwise `never` (unusable for selection).
type ChoiceVal<C> =
    C extends { value: infer V } ? V :
    C extends string | number ? C :
    never;

// The "Inquirer value" we will ultimately return from the adapter.
type InqValue = ChoiceVal<InqChoice>;

// -----------------------------------------------------------------------------
// Focused type guards (no wide casts leaked into business logic)
// -----------------------------------------------------------------------------

function isObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
}

function hasValue<V>(c: unknown): c is { value: V } {
    // We only *peek* to check the presence of "value"; we do not trust its type here.
    return isObject(c) && 'value' in c;
}

function hasName(c: unknown): c is { name: string } {
    return isObject(c) && typeof c.name === 'string';
}

function isScalarChoice(c: unknown): c is string | number {
    return typeof c === 'string' || typeof c === 'number';
}

// -----------------------------------------------------------------------------
// Safe extraction helpers (avoid wide casts in call sites)
// -----------------------------------------------------------------------------

function extractChoices(config: InqParams): readonly unknown[] {
    if (!isObject(config)) return [];
    const cs = (config as { choices?: unknown }).choices;
    return Array.isArray(cs) ? cs : [];
}

function extractMessage(config: InqParams): string | undefined {
    if (!isObject(config)) return undefined;
    const msg = (config as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : undefined;
}

function extractDefault(config: InqParams): unknown {
    if (!isObject(config)) return undefined;
    return (config as { default?: unknown }).default;
}

// -----------------------------------------------------------------------------
// Equality strategy
// - Allow callers to inject a comparator if value identity semantics differ
//   (e.g., deep equals vs strict identity).
// -----------------------------------------------------------------------------

type Eq = (a: unknown, b: unknown) => boolean;
const defaultEq: Eq = Object.is;

// -----------------------------------------------------------------------------
// Adapter: SelectLike<T> -> InquirerSelect-compatible callable
//
// Design notes:
// - We constrain T to be assignable to InqValue so that comparisons happen
//   in the same "value space" (no more `as unknown as T`).
// - We build two views from `choices`: items with { value }, and scalar choices.
// - Decision order: preferred -> default -> by name -> first valued -> first scalar.
// - We attach `cancel` both to the returned promise and to the callable itself.
// -----------------------------------------------------------------------------

export function toInquirerSelect<T extends InqValue>(
    selectLike: SelectLike<T>,
    eq: Eq = defaultEq
) {
    async function core(config: InqParams): Promise<InqValue> {
        const choices = extractChoices(config);
        const message = extractMessage(config);
        const def = extractDefault(config);

        // Ask the logical selector for a preferred value (type-safe: T <: InqValue)
        const preferred = await selectLike({
            message,
            // Note: choices are forwarded as T[] to support decision logic inside selectLike.
            // This is safe by design because T is constrained to InqValue, which is derived
            // from the actual choices shape; runtime remains tolerant for unknown items.
            choices: choices as readonly T[],
        });

        // One pass to categorize choices
        const valued: { value: InqValue; name?: string }[] = [];
        const scalars: (string | number)[] = [];

        for (const ch of choices) {
            if (hasValue<InqValue>(ch)) {
                valued.push({
                    value: (ch as { value: InqValue }).value, // value read is typed via guard
                    name: hasName(ch) ? (ch as { name: string }).name : undefined,
                });
            } else if (isScalarChoice(ch)) {
                scalars.push(ch);
            }
        }

        // 1) Match on preferred against { value }
        for (const c of valued) {
            if (eq(c.value, preferred)) return c.value;
        }

        // 2) Match on default against { value }
        if (def !== undefined) {
            for (const c of valued) {
                if (eq(c.value, def)) return c.value;
            }
        }

        // 3) Match on name -> value (if preferred is a string)
        if (typeof preferred === 'string') {
            for (const c of valued) {
                if (c.name !== undefined && eq(c.name, preferred)) return c.value;
            }
        }

        // 4) Fallbacks: first valued, otherwise first scalar (string|number)
        if (valued.length > 0) return valued[0].value;
        if (scalars.length > 0) return scalars[0] as InqValue;

        throw new Error(
            `toInquirerSelect: no usable choice found (choices.length=${choices.length}, message=${message ?? '∅'})`
        );
    }

    // Propagate cancel when available; otherwise no-op for compatibility.
    // Synchronous return type to match Inquirer: cancel(): void
    const cancel = () => {
        if (selectLike.cancel) {
            void selectLike.cancel({});
        }
    };

    // Broad compatibility:
    // - Generic callable enriched with `cancel` (some callers expect this)
    // - Returned promise enriched with `cancel` (other callers attach it on the promise)
    const callable = <Value>(opts: InqParams, _context?: unknown) => {
        void _context; // keep the parameter for structural compatibility with Inquirer
        const p = core(opts) as Promise<Value>;
        return Object.assign(p, { cancel });
    };

    const inquirerCompat = Object.assign(callable, { cancel });

    return inquirerCompat;
}
