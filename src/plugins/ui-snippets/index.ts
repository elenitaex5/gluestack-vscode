import * as vscode from "vscode";
import { BasePlugin } from "../base-plugin";
import COMPONENT_COMPLETIONS from "./COMPONENT_COMPLETIONS";
import { PluginController } from "../../PluginController";

export class GluestackProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Thenable<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    if (!linePrefix.endsWith("gs-")) {
      return Promise.resolve([]);
    }

    const startPos = position.translate(0, -3);

    const completionItems = Object.entries(COMPONENT_COMPLETIONS).map(
      ([snippetName, component]) => {
        const completionItem = new vscode.CompletionItem(
          snippetName,
          vscode.CompletionItemKind.Class
        );
        completionItem.insertText = new vscode.SnippetString(
          component.template
        );
        completionItem.additionalTextEdits = [
          vscode.TextEdit.replace(new vscode.Range(startPos, position), ""),
        ];
        completionItem.command = {
          command: "extension.addImports",
          title: "Add Imports",
          arguments: [component.imports],
        };
        return completionItem;
      }
    );

    return Promise.resolve(completionItems);
  }
}

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
  activate(context: vscode.ExtensionContext) {
    console.log("Congratulations, you are in activate of ui-snippets plugin!");

    // Register the GluestackProvider as a completion item provider
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        ["typescript", "typescriptreact", "javascript", "javascriptreact"],
        new GluestackProvider(),
        "g",
        "s",
        "-"
      )
    );

    // Register the command to add imports
    context.subscriptions.push(
      vscode.commands.registerCommand("extension.addImports", (imports) => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const document = editor.document;

          // Group imports by their import source (from clause)
          const groupedImports: any = {};
          imports.forEach((importInfo: any) => {
            const source = importInfo.importFrom;
            if (!groupedImports[source]) {
              groupedImports[source] = [];
            }
            groupedImports[source].push(importInfo);
          });

          // Generate batched import statements
          const importStatements = Object.entries(groupedImports)
            .map(([source, imports]: any) => {
              const importText = imports.map((importInfo: any) => {
                if (importInfo.importType === "default") {
                  return `${importInfo.importName}`;
                } else {
                  return `${importInfo.importName}`;
                }
              });
              return `import { ${importText.join(", ")} } from "${source}";`;
            })
            .join("\n");

          // Create a workspace edit and apply it to add the batched import statements
          const edit = new vscode.WorkspaceEdit();
          edit.insert(
            document.uri,
            new vscode.Position(0, 0),
            importStatements + "\n\n"
          );
          vscode.workspace.applyEdit(edit);
        }
      })
    );
  }
}
