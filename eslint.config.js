/**
 * Une seule chose nous intéresse ici : attraper les identifiants qui n'existent
 * pas. Le bundler, lui, les laisse passer sans un mot — et ça se termine en
 * page blanche au milieu d'une partie.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/**', 'client/dist/**'],
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Le filet principal : aucune variable inventée.
      'no-undef': 'error',
      // Bruit inutile pour ce projet.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
