const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        __dirname: 'readonly',
        Audio: 'readonly',
        bootbox: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        describe: 'readonly',
        document: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        location: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        $: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      semi: ['error', 'always']
    }
  }
];
