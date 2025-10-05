#!/usr/bin/env ts-node
import 'ts-node/register/transpile-only';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const PKG_ROOT = path.resolve(__dirname, '..');

// Modules to build
const MODULES = ['addresses', 'abis', 'constants', 'paymentMethods', 'networks', 'types', 'utils'];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function compileModule(moduleName: string, format: 'esm' | 'cjs') {
  const inputDir = path.join(PKG_ROOT, moduleName);
  const outputDir = path.join(PKG_ROOT, format === 'esm' ? '_esm' : '_cjs', moduleName);
  
  function processDirectory(currentInputDir: string, currentOutputDir: string, relativePath: string = '') {
    ensureDir(currentOutputDir);
    
    const entries = fs.readdirSync(currentInputDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const inputPath = path.join(currentInputDir, entry.name);
      const outputPath = path.join(currentOutputDir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        processDirectory(inputPath, outputPath, path.join(relativePath, entry.name));
      } else if (entry.name.endsWith('.json')) {
        // Copy JSON files directly
        fs.copyFileSync(inputPath, outputPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        // Compile TypeScript files
        const source = fs.readFileSync(inputPath, 'utf8');
        
        // Simple transformation for imports/exports
        let transformed = source;
        
        if (format === 'cjs') {
          // Convert ES modules to CommonJS
          transformed = transformed
            .replace(/export \{ default as (\w+) \} from '\.\/(.+)\.json'/g, 
                    "exports.$1 = require('./$2.json')")
            .replace(/export \* as (\w+) from '\.\/(.+)'/g, 
                    "exports.$1 = require('./$2')")
            .replace(/export \{([^}]+)\} from '\.\/(.+)'/g, 
                    "Object.assign(exports, require('./$2'))")
            .replace(/import type \{([^}]+)\} from '\.\/(.+)'/g, '')
            .replace(/export type \{([^}]+)\}/g, '');
        }
        
        // Write the output file with .js extension
        const jsPath = outputPath.replace(/\.ts$/, '.js');
        fs.writeFileSync(jsPath, transformed);
      } else if (entry.name.endsWith('.d.ts')) {
        // Copy declaration files to _types
        const typesDir = path.join(PKG_ROOT, '_types', moduleName, relativePath);
        ensureDir(typesDir);
        fs.copyFileSync(inputPath, path.join(typesDir, entry.name));
      } else if (entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) {
        // Copy generated wrapper files to output directory
        fs.copyFileSync(inputPath, outputPath);
      }
    }
  }
  
  processDirectory(inputDir, outputDir);
}

function buildMainIndex() {
  // Build simple main index files
  const esmIndex = `// Auto-generated main entry point
export const version = require('../package.json').version;
`;
  
  const cjsIndex = `// Auto-generated main entry point
exports.version = require('../package.json').version;
`;
  
  ensureDir(path.join(PKG_ROOT, '_esm'));
  ensureDir(path.join(PKG_ROOT, '_cjs'));
  
  fs.writeFileSync(path.join(PKG_ROOT, '_esm', 'index.js'), esmIndex);
  fs.writeFileSync(path.join(PKG_ROOT, '_cjs', 'index.js'), cjsIndex);
  
  // Create main type definition
  const typesIndex = `// Auto-generated type definitions
export declare const version: string;
`;
  
  ensureDir(path.join(PKG_ROOT, '_types'));
  fs.writeFileSync(path.join(PKG_ROOT, '_types', 'index.d.ts'), typesIndex);
}

async function main() {
  console.log('📦 Building modules...');
  
  // Build each module
  for (const module of MODULES) {
    if (fs.existsSync(path.join(PKG_ROOT, module))) {
      console.log(`  Building ${module}...`);
      compileModule(module, 'esm');
      compileModule(module, 'cjs');
    }
  }
  
  // Build main index
  buildMainIndex();
  
  console.log('✅ Build complete');
}

main().catch(console.error);
