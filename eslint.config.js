// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'coverage/**', 'data/**'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../lib/supabase/admin',
              message:
                'src/lib/supabase/admin.ts uses the service_role key and must never be imported from client-facing code.',
            },
            {
              name: '@/lib/supabase/admin',
              message:
                'src/lib/supabase/admin.ts uses the service_role key and must never be imported from client-facing code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Mocking a third-party client's shape legitimately needs `any` here.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // app/**/client components importing the admin (service_role) client
    // would be a severe security bug. Route Handlers under app/api/**
    // are server-only and are the one place admin.ts may legitimately be
    // imported from within app/ (none exist yet in Phase 4).
    files: ['app/**/*.tsx'],
    ignores: ['app/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@/lib/supabase/admin', message: 'Never import the service_role client from a page/component.' },
          ],
        },
      ],
    },
  },
  {
    // The base rule above (files: ['src/**/*.ts', 'tests/**/*.ts',
    // 'app/**/*.{ts,tsx}']) bans importing admin.ts with no exception,
    // which would also block app/api/** Route Handlers even though the
    // block above already documents them as the one legitimate place
    // within app/ to import it (that block only matches *.tsx and can't
    // reach route.ts). Phase 7 is the first phase to actually add a
    // Route Handler (app/api/contractors/register/route.ts) that needs
    // the service_role client for role promotion + the pending
    // contractor insert, so this override — restoring the exception the
    // comment above always intended — is now load-bearing, not
    // speculative.
    files: ['app/api/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
