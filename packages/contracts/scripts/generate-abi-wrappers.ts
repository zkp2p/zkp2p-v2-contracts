#!/usr/bin/env ts-node
import 'ts-node/register/transpile-only';
import * as fs from 'fs';
import * as path from 'path';

const PKG_ROOT = path.resolve(__dirname, '..');
const ABIS_DIR = path.join(PKG_ROOT, 'abis');

interface NetworkContracts {
  [network: string]: string[];
}

function getNetworkContracts(): NetworkContracts {
  const networks: NetworkContracts = {};
  
  if (!fs.existsSync(ABIS_DIR)) {
    console.warn('No abis directory found');
    return networks;
  }
  
  const entries = fs.readdirSync(ABIS_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const networkDir = path.join(ABIS_DIR, entry.name);
      const files = fs.readdirSync(networkDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.basename(f, '.json'));
      
      if (files.length > 0) {
        networks[entry.name] = files;
      }
    }
  }
  
  return networks;
}

function generateCommonJSWrapper(network: string, contracts: string[]): string {
  const imports = contracts.map(contract => 
    `  ${contract}: require('./${network}/${contract}.json')`
  ).join(',\n');
  
  return `// Auto-generated CommonJS wrapper for ${network} ABIs
module.exports = {
${imports}
};
`;
}

function generateESMWrapper(network: string, contracts: string[]): string {
  const imports = contracts.map(contract => 
    `import ${contract} from './${network}/${contract}.json' assert { type: 'json' };`
  ).join('\n');
  
  const exports = contracts.map(c => c).join(', ');
  
  return `// Auto-generated ESM wrapper for ${network} ABIs
${imports}

export {
  ${exports}
};
`;
}

function generateTypeDefinitions(network: string, contracts: string[]): string {
  const exports = contracts.map(contract => 
    `export declare const ${contract}: any;`
  ).join('\n');
  
  return `// Auto-generated TypeScript definitions for ${network} ABIs
${exports}
`;
}

function updatePackageExports(networks: string[]): void {
  const packageJsonPath = path.join(PKG_ROOT, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Update or create exports for each network
  if (!packageJson.exports) {
    packageJson.exports = {};
  }
  
  // Keep existing root exports
  const existingRootExports = {
    '.': packageJson.exports['.'],
    './addresses': packageJson.exports['./addresses'],
    './addresses/*': packageJson.exports['./addresses/*'],
    './constants': packageJson.exports['./constants'],
    './constants/*': packageJson.exports['./constants/*'],
    './paymentMethods': packageJson.exports['./paymentMethods'],
    './paymentMethods/*': packageJson.exports['./paymentMethods/*'],
    './types': packageJson.exports['./types'],
    './utils': packageJson.exports['./utils'],
    './utils/protocolUtils': packageJson.exports['./utils/protocolUtils']
  };
  
  // Create new exports object with proper ordering
  const newExports: any = {
    ...existingRootExports
  };
  
  // Add explicit network exports
  for (const network of networks) {
    newExports[`./abis/${network}`] = {
      types: `./abis/${network}.d.ts`,
      import: `./abis/${network}.mjs`,
      require: `./abis/${network}.cjs`,
      default: `./abis/${network}.cjs`
    };
    
    // Also allow direct JSON imports
    newExports[`./abis/${network}/*.json`] = `./abis/${network}/*.json`;
  }
  
  // Add general abis exports for backward compatibility
  newExports['./abis'] = {
    types: './abis/index.ts',
    import: './abis/index.ts',
    require: './abis/index.ts',
    default: './abis/index.ts'
  };
  
  packageJson.exports = newExports;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ Updated package.json exports');
}

async function main() {
  console.log('🔧 Generating ABI wrapper files...');
  
  const networks = getNetworkContracts();
  const networkNames = Object.keys(networks);
  
  if (networkNames.length === 0) {
    console.log('No networks found to process');
    return;
  }
  
  for (const network of networkNames) {
    const contracts = networks[network];
    console.log(`  📦 Processing ${network} with ${contracts.length} contracts`);
    
    // Generate CommonJS wrapper
    const cjsPath = path.join(ABIS_DIR, `${network}.cjs`);
    fs.writeFileSync(cjsPath, generateCommonJSWrapper(network, contracts));
    
    // Generate ESM wrapper
    const mjsPath = path.join(ABIS_DIR, `${network}.mjs`);
    fs.writeFileSync(mjsPath, generateESMWrapper(network, contracts));
    
    // Generate TypeScript definitions
    const dtsPath = path.join(ABIS_DIR, `${network}.d.ts`);
    fs.writeFileSync(dtsPath, generateTypeDefinitions(network, contracts));
  }
  
  // Update package.json exports
  updatePackageExports(networkNames);
  
  console.log('✅ Successfully generated wrapper files for:', networkNames.join(', '));
}

main().catch(console.error);