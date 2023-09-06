import { BasePlugin } from "./plugins/base-plugin";
import * as vscode from "vscode";

export class PluginController {
  private plugins: BasePlugin[] = [];

  constructor() {}

  // Install a plugin
  installPlugin(pluginInstance: BasePlugin): void {
    this.plugins.push(pluginInstance);
  }

  // Activate all plugins
  activateAll(context: vscode.ExtensionContext): void {
    for (const plugin of this.plugins) {
      plugin.activate(context);
    }
  }

  // Get all plugin instances
  getAllPluginInstances(): BasePlugin[] {
    return this.plugins;
  }

  // Get a plugin instance by plugin class
  getPluginInstance<T extends BasePlugin>(
    pluginClass: new (controller: PluginController) => T
  ): T | undefined {
    return this.plugins.find((plugin) => plugin instanceof pluginClass) as T;
  }
}
