import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-rubocop.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path", "url"],
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist/types",
        rootDir: "src/",
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-rubocop.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path"],
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
