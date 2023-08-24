const fs = require('fs').promises;
const path = require('path');
const prompts = require('prompts');

function hyphenToCamel(input) {
  return input
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

async function updatePackageJson(pluginName) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json'); // Update the path accordingly

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    // Add the new script to the scripts section
    packageJson.scripts[
      `build:${pluginName}`
    ] = `npm run build --workspace ${pluginName}`;

    packageJson.scripts[
      `watch:${pluginName}`
    ] = `npm run watch --workspace ${pluginName}`;

    // Check if the script already exists in packageJson.scripts['watch']
    if (!packageJson.scripts['watch'].includes(`npm run watch:${pluginName}`)) {
      packageJson.scripts['watch'] += ` & npm run watch:${pluginName}`;
    }

    // Check if the script already exists in packageJson.scripts['build']
    if (!packageJson.scripts['build'].includes(`npm run build:${pluginName}`)) {
      packageJson.scripts['build'] += ` & npm run build:${pluginName}`;
    }

    // Write the updated package.json back to the file
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('package.json updated successfully!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function createPlugin(pluginName) {
  const CamelCasePluginName = hyphenToCamel(pluginName);
  const currDir = process.cwd();
  const pluginDir = path.join(currDir, 'packages', pluginName);

  const srcFolderPath = path.join(pluginDir, 'src');
  const indexFilePath = path.join(srcFolderPath, 'index.ts');
  const gitIgnorePath = path.join(pluginDir, '.gitignore');
  const packageJsonPath = path.join(pluginDir, 'package.json');
  const tsConfigPath = path.join(pluginDir, 'tsconfig.json');

  const pluginContent = `import { BasePlugin } from 'core';

export class ${CamelCasePluginName} extends BasePlugin {
  dependencies: string[] = [];
  name: string = '${pluginName}';

  async init() {
    console.log(\`Plugin \${this.name} initiated!\`);
  }

  async run() {
    console.log(\`Plugin \${this.name}  run method executed!\`);
  }

  async rollback() {
    console.log('Rollback method implementation for ', this.name);
  }

  async commit() {
    console.log('Committing plugin:', this.name);
  }
}
  `;

  const gitIgnoreContent = `# Ignore node_modules directory
node_modules/*

# Ignore build files
dist/*

# Ignore .env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env*.local

# Ignore .env override files
.env.override
.env.development.override
.env.test.override
.env.production.override
.env*.override
`;

  const packageJsonContent = `{
  "name": "${pluginName}",
  "version": "0.1.0",
  "description": "Generation script framework plugin template",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1",
    "build": "tsc",
    "watch": "tsc --watch",
    "dev": "node dist/index.js"
  },
  "author": "mayank <pagarmayank07@gmail.com> (https://github.com/mayank-96)",
  "license": "ISC",
  "devDependencies": {
    "@types/node": "^20.4.6",
    "typescript": "^5.1.6"
  },
  "dependencies": {
    "core": "*"
  }
}
`;

  const tsConfigContent = `{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
  },
  "include": ["./src"]
}
`;

  try {
    await fs.mkdir(pluginDir, { recursive: true });

    await fs.mkdir(srcFolderPath, { recursive: true });
    await fs.writeFile(indexFilePath, pluginContent);

    await fs.writeFile(gitIgnorePath, gitIgnoreContent);
    await fs.writeFile(packageJsonPath, packageJsonContent);
    await fs.writeFile(tsConfigPath, tsConfigContent);

    updatePackageJson(pluginName);

    console.log(`Plugin "${pluginName}" created successfully!`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function main() {
  let pluginName = process.argv[2];

  if (!pluginName) {
    const response = await prompts([
      {
        type: 'text',
        name: 'pluginName',
        message: 'Enter the plugin name:',
      },
    ]);

    pluginName = response.pluginName;
  }

  const pluginTypes = ['build', 'publish'];

  for (const pluginType of pluginTypes) {
    await createPlugin(`plugin-${pluginName}-${pluginType}`);
  }
}

main();
