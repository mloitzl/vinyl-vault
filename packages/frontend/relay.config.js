module.exports = {
  src: './src',
  schema: '../bff/src/schema.graphql',
  language: 'typescript',
  artifactDirectory: './src/__generated__',
  exclude: ['**/node_modules/**', '**/__mocks__/**', '**/__generated__/**'],
};
