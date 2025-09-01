import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

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
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json()
    ]
  },
  // Minified UMD build (for browser usage)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'ZKP2PContracts',
      sourcemap: true,
      globals: {
        ethers: 'ethers'
      }
    },
    external: ['ethers'],
    plugins: [
      typescript({ 
        tsconfig: './tsconfig.json',
        declaration: false 
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      terser()
    ]
  }
];