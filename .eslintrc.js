module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    browser: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'no-param-reassign': ['error', { props: false }],
    'no-console': 'off',
  },
};
