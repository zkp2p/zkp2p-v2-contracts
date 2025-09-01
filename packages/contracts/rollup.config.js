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
      file: 'dist/index.esm.js',
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
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    external,
    plugins: [
      typescript({ 
        tsconfig: './tsconfig.build.json',
        declaration: false
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  }
];
