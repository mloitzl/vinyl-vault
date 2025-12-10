const path = require('path');

module.exports = {
  src: './src',
  schema: path.resolve(__dirname, '../bff/src/schema.graphql'),
  language: 'typescript',
  artifactDirectory: './src/__generated__',
  exclude: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
};
