import path from 'path';
import { fileURLToPath } from 'url';

// commonJS import
import upath from 'upath';
export const { joinSafe } = upath;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url))

export const CONFIGS_DIR = joinSafe(CURRENT_DIR, "..", "configs");
export const NIX_CONFIGS_DIR = joinSafe(CONFIGS_DIR, "nix")
export const WOLF_CONFIGS_DIR = joinSafe(CONFIGS_DIR, "wolf")