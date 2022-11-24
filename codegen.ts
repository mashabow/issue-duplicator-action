
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: "https://docs.github.com/public/schema.docs.graphql",
  generates: {
    "src/graphql.ts": {
      plugins: ["typescript"]
    }
  }
};

export default config;
