import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';

export default [
  {
    ignores: ['.react-router/**', 'build/**', 'node_modules/**', 'river-thread-web/**'],
    linterOptions: {reportUnusedDisableDirectives: 'off'},
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    rules: {
      ...config.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'off',
    },
  })),
  {
    files: ['app/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'playwright.config.ts'],
    plugins: {react},
    rules: {
      'no-debugger': 'error',
      'react/no-array-index-key': 'off',
    },
  },
];
