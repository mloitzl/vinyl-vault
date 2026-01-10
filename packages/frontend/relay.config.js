const path = require('path');

module.exports = {
  language: 'typescript',
  schema: path.resolve(__dirname, '../bff/src/schema.graphql'),
  src: './src',
  artifactDirectory: './src/__generated__',
  exclude: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
};
