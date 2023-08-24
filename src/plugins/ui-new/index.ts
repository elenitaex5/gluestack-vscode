import * as vscode from "vscode";
import { BasePlugin } from "../base-plugin";
import { PluginController } from "../../PluginController";

export class PluginUISnippets implements BasePlugin {
  pluginId: string = "PluginUISnippets";

  private pluginController: PluginController; // Reference to PluginController

  constructor(pluginController: PluginController) {
    this.pluginController = pluginController;
  }

  install(): void {
    throw new Error("Method not implemented.");
  }

  checkAuth(context: vscode.ExtensionContext): void {
    console.log("Auth worked");
    const token = context.globalState.get("authToken");
    console.log(token);
  }

  // Activate the plugin
  activate(context: vscode.ExtensionContext): void {
    console.log("Congratulations, you are in activate of ui-snippets plugin !");
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        "javascript",
        new GluestackProvider(),
        "g",
        "s",
        "-"
      )
    );

    let authCommand = vscode.commands.registerCommand(
      "gluestack-vscode.handleInsertImport",
      async () => {
        context.subscriptions.push(
          vscode.commands.registerCommand(
            "gluestack-vscode.handleInsertImport",
            handleInsertImport
          )
        );
      }
    );

    let helloCommand = vscode.commands.registerCommand(
      "gluestack-vscode.helloWorld",
      () => {
        vscode.window.showInformationMessage(
          "Hello Meenu!!! Test World from gluestack-vscode!"
        );
      }
    );
    context.subscriptions.push(helloCommand, authCommand);
  }
}
