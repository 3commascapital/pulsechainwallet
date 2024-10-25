module.exports = {
  // Specify the schema URL
  schema: 'https://pulsechainwallet-indexer.up.railway.app',
  target: 'typescript',
  generates: {
    './src/main/indexer/gql/': {
      preset: 'client',
      plugins: [
        'typescript',
        'typescript-operations',
      ],
    },
  },
};
