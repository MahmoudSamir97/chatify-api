module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: 'eslint:recommended',
  ignorePatterns: ['node_modules/', 'coverage/'],
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: { jest: true },
    },
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'no-console': 'warn',
    'no-unused-vars': ['error', { args: 'none' }],
    'prefer-const': 'error',
  },
};
