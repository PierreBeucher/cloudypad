import path from 'path';
import { fileURLToPath } from 'url';

// upath cannot be imported directly as it's CommonJS module
// ts-node gives error:
// SyntaxError: Named export 'joinSafe' not found. The requested module 'upath' is a CommonJS module, which may not support all module.exports as named exports.
// CommonJS modules can always be imported via the default export, for example using:
import upathpkg from 'upath'; // actual provided example
export const { joinSafe } = upathpkg;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

export const INFRA_DIR = joinSafe(CURRENT_DIR, "..", "..", "infra");
export const PROVISION_DIR = joinSafe(CURRENT_DIR, "..", "..", "provision");
export const NIX_PROVISION_DIR = joinSafe(PROVISION_DIR, "nix")
export const WOLF_PROVISION_DIR = joinSafe(PROVISION_DIR, "wolf")

