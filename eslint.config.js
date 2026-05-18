import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // 명백한 버그성만 에러로, 스타일은 경고로 (점진적 정리)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'off', // TS가 처리
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'off', // 너무 공격적
      'preserve-caught-error': 'off', // 노이즈
      'no-constant-condition': ['warn', { checkLoops: false }],
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'warn',
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'v3/**', 'v2/**', '.vite/**'],
  },
];