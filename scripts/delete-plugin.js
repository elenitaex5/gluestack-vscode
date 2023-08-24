const fs = require('fs').promises;
const path = require('path');
const prompts = require('prompts');

async function updatePackageJson(pluginName, remove = false) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json'); // Update the path accordingly

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    const buildScript = `npm run build:${pluginName}`;
    const watchScript = `npm run watch:${pluginName}`;

    if (remove) {
      // Remove the build and watch scripts if they exist
      if (packageJson.scripts['build']) {
        packageJson.scripts['build'] = packageJson.scripts['build'].replace(
          ` & ${buildScript}`,
          ''
        );
      }

      if (packageJson.scripts['watch']) {
        packageJson.scripts['watch'] = packageJson.scripts['watch'].replace(
          ` & ${watchScript}`,
          ''
        );
      }

      // Delete the individual scripts for build and watch
      delete packageJson.scripts[`build:${pluginName}`];
      delete packageJson.scripts[`watch:${pluginName}`];
    }

    // Write the updated package.json back to the file
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('package.json updated successfully!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function removePlugin(pluginName) {
  const currDir = process.cwd();
  const pluginDir = path.join(currDir, 'packages', pluginName);

  try {
    // Remove the plugin directory
    await fs.rm(pluginDir, { recursive: true, force: true });

    // Update package.json to remove plugin's build and watch scripts
    updatePackageJson(pluginName, true);

    console.log(`Plugin "${pluginName}" removed successfully!`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

async function listPlugins() {
  const pluginsPath = path.join(process.cwd(), 'packages');
  const plugins = await fs.readdir(pluginsPath);
  return plugins.filter((plugin) => plugin.startsWith('plugin-'));
}

async function main() {
  let pluginName = process.argv[2];

  if (!pluginName) {
    const plugins = await listPlugins();

    const response = await prompts([
      {
        type: 'select',
        name: 'pluginName',
        message: 'Select a plugin:',
        choices: plugins.map((plugin) => ({ title: plugin, value: plugin })),
      },
    ]);

    pluginName = response.pluginName;
  }

  await removePlugin(pluginName);
}

main();
