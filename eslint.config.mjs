// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
// import foo from '@typescript-eslint/parser'
import * as eslintImport from 'eslint-plugin-import'

export default tseslint.config(
    {
        ignores: ["dist/", "tmp/"],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
          'import': eslintImport
        },
        rules: {
          'import/no-cycle': ['warn', { maxDepth: Infinity }]
        },
    },
)