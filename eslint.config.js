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
      // Phase 8: switched from a `paths` list (literal specifier
      // strings — only ever caught `../lib/supabase/admin` and
      // `@/lib/supabase/admin` exactly, silently missing every other
      // relative depth, e.g. `../supabase/admin` from a file under
      // src/lib/*/) to a `patterns` glob, so this is robust to where the
      // importing file actually lives instead of one hand-maintained
      // list of exact strings. Found while confirming app/api/** really
      // is the only place admin.ts gets imported from for Phase 8's new
      // admin routes — the old rule would not have caught a stray import
      // from, say, src/lib/auth/ at all.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/admin'],
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
    // The base rule above (files: ['src/**/*.ts', 'tests/**/*.ts',
    // 'app/**/*.{ts,tsx}']) bans importing admin.ts with no exception —
    // Route Handlers under app/api/** (always .ts, never .tsx) are the
    // one legitimate place within app/ to import it: Phase 7's
    // registration route (role promotion + the pending contractor
    // insert) and Phase 8's admin approval routes (requireAdmin's
    // service_role profile-role check, plus every approve/reject write)
    // both need it. This override restores that exception for exactly
    // that directory.
    files: ['app/api/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
