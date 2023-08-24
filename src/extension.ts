import * as vscode from "vscode";

// Plugin Imports
import { PluginAuth } from "./plugins/auth";
import { PluginUISnippets } from "./plugins/plugin-ui-snippets";

// Plugin Controller
import { PluginController } from "./PluginController";

// Create Plugin Controller Instance
const pluginController = new PluginController();

// Create all plugin instances
const pluginUISnippetsInstance = new PluginUISnippets(pluginController);
const pluginAuthInstance = new PluginAuth(pluginController);

// Install all plugins
pluginController.installPlugin(pluginUISnippetsInstance);
pluginController.installPlugin(pluginAuthInstance);

// Activate all plugins
export function activate(context: vscode.ExtensionContext) {
  pluginController.activateAll(context);
}

export function deactivate() {}
