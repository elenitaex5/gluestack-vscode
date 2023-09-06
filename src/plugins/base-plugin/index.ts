import * as vscode from "vscode";

// BasePlugin interface
export interface BasePlugin {
  pluginId: string;
  install(): void;
  activate(context: vscode.ExtensionContext): void;
}
