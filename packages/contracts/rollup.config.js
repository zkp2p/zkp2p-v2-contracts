import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const external = ['ethers', 'fs', 'path'];

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: '_esm/index.js',
      format: 'es',
      sourcemap: true
    },
    external,
    plugins: [
      typescript({ 
        tsconfig: './tsconfig.esm.json',
        declaration: false 
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: '_cjs/index.js',
      format: 'cjs',
      sourcemap: true
    },
    external,
    plugins: [
      typescript({ 
        tsconfig: './tsconfig.build.json',
        declaration: true,
        declarationDir: './_types',
        rootDir: './src'
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  }
];
