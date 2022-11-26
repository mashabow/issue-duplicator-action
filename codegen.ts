import type {CodegenConfig} from '@graphql-codegen/cli'

const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://docs.github.com/public/schema.docs.graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/graphql/index.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-generic-sdk'
      ],
      config: {
        documentMode: 'string'
      }
    }
  }
}

export default config
