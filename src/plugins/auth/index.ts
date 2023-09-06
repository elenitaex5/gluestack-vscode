import { PluginController } from "./../../PluginController";
import { PluginUISnippets } from "../ui-snippets";
import * as vscode from "vscode";
import { BasePlugin } from "../base-plugin";

export class PluginAuth implements BasePlugin {
  pluginId: string = "PluginAuth";

  private pluginController: PluginController; // Reference to PluginController

  constructor(pluginController: PluginController) {
    this.pluginController = pluginController;
  }

  install(): void {
    throw new Error("Method not implemented.");
  }

  // Activate the plugin
  activate(context: vscode.ExtensionContext): void {
    console.log("Congratulations, you are in activate of auth plugin !");

    let authCommand = vscode.commands.registerCommand(
      "gluestack-vscode.authenticate",
      async () => {
        // const token = vscode.workspace.getConfiguration().get("gs-auth.token");
        const token = context.globalState.get("authToken");
        if (token) {
          // Make API call to verify
          vscode.window.showInformationMessage("User already authenticated!");
        } else {
          await authenticate(context);
          const pluginUISnippetsInstance =
            this.pluginController.getPluginInstance(PluginUISnippets);
          pluginUISnippetsInstance?.checkAuth(context);
        }
      }
    );

    context.subscriptions.push(authCommand);
  }
}

async function authenticate(context: vscode.ExtensionContext) {
  const authorizationUrl = "http://localhost:4001/";

  // Open a webview for authentication
  const panel = vscode.window.createWebviewPanel(
    "authPanel",
    "Authenticate",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  // Load the authorization URL in the webview
  panel.webview.html = getWebviewContent(authorizationUrl);

  panel.webview.onDidReceiveMessage((message) => {
    if (message.text) {
      const payload = JSON.parse(message.text);
      // vscode.workspace
      //   .getConfiguration()
      //   .update(
      //     "gs-auth.token",
      //     payload.token,
      //     vscode.ConfigurationTarget.Global
      //   );

      context.globalState.update("authToken", payload.token);
      vscode.window.showInformationMessage("Authentication successful");
      panel.dispose();
    }
  });
}

function getWebviewContent(url: string) {
  return `
  <html>
    <body style="margin: 0; padding: 0; overflow: hidden; background-color: #f2f2f2;">
        <iframe id="iframeId" src="${url}" style="width: 100%; height: 100vh; border: none;"></iframe>
        <script>
          (function() {
              const vscode = acquireVsCodeApi();
                    window.addEventListener('message', event => {
                      vscode.postMessage({
                        command:'alert',
                        text:JSON.stringify(event.data)
                      })
                  });
          }())
        </script>
    </body>
  </html>
  `;
}
