import * as vscode from "vscode";
import { BasePlugin } from "../base-plugin";
import COMPONENT_COMPLETIONS from "./COMPONENT_COMPLETIONS";
import { PluginController } from "../../PluginController";
import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";

// Constants for extension identifiers and commands
const EXTENSION_ID = "PluginUISnippets";
const ADD_DEPENDENT_CODE_COMMAND = "extension.addDependentCode";
const PREFIX = "gs-";

export class GluestackProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    if (!linePrefix.endsWith(PREFIX)) {
      return [];
    }

    const startPos = position.translate(0, -PREFIX.length);

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
          command: ADD_DEPENDENT_CODE_COMMAND,
          title: "Add Dependent Code",
          arguments: [component],
        };
        return completionItem;
      }
    );

    return completionItems;
  }
}

export class PluginUISnippets implements BasePlugin {
  pluginId: string = EXTENSION_ID;
  private pluginController: PluginController;

  constructor(pluginController: PluginController) {
    this.pluginController = pluginController;
  }

  install(): void {
    // Implement error handling here instead of throwing an error.
  }

  checkAuth(context: vscode.ExtensionContext): void {
    try {
      console.log("Auth worked");
      const token = context.globalState.get("authToken");
      console.log(token);
    } catch (error) {
      console.error("Error checking authentication:", error);
    }
  }

  async activate(context: vscode.ExtensionContext) {
    try {
      console.log(
        "Congratulations, you are in activate of ui-snippets plugin!"
      );

      context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
          ["typescript", "typescriptreact", "javascript", "javascriptreact"],
          new GluestackProvider(),
          "g",
          "s",
          "-"
        )
      );

      // Register the command to add dependent code
      context.subscriptions.push(
        vscode.commands.registerCommand(
          ADD_DEPENDENT_CODE_COMMAND,
          async (component) => {
            try {
              await this.addImports(component.imports);
              await this.addVariableStatements(component.variableStatements);
            } catch (error) {
              console.error("Error adding dependent code:", error);
            }
          }
        )
      );
    } catch (error) {
      console.error("Error activating extension:", error);
    }
  }

  private async addImports(imports: any[]): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;

      const groupedImports: Record<string, any[]> = {};
      imports.forEach((importInfo: any) => {
        const source = importInfo.importFrom;
        if (!groupedImports[source]) {
          groupedImports[source] = [];
        }
        groupedImports[source].push(importInfo);
      });

      const importStatements = Object.entries(groupedImports)
        .map(([source, imports]: [string, any[]]) => {
          const importText = imports.map((importInfo: any) => {
            return importInfo.importType === "default"
              ? importInfo.importName
              : `${importInfo.importName}`;
          });
          return `import { ${importText.join(", ")} } from "${source}";`;
        })
        .join("\n");

      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        document.uri,
        new vscode.Position(0, 0),
        importStatements + "\n\n"
      );
      await vscode.workspace.applyEdit(edit);
    }
  }

  private async addVariableStatements(
    variableStatements: string
  ): Promise<void> {
    // const editor = vscode.window.activeTextEditor;
    // if (editor) {
    //   const document = editor.document;
    //   const selection = editor.selection;
    //   const code = document.getText();
    //   const ast = parser.parse(code, {
    //     sourceType: "module", // or 'script' for non-module code
    //     plugins: ["jsx", "typescript"], // Include any necessary plugins
    //   });
    //   const cursorPosition = selection.active;
    //   const documentCursorOffset = document.offsetAt(cursorPosition) - 1;
    //   let nodeloc = null;
    //   let foundNode: any = null;
    //   let closestNode = null;
    //   let closestDistance = Infinity;
    //   let returnStatementParent = null;
    //   let parentPathOfReturnStatement = null;
    //   traverse(ast, {
    //     enter(path: any) {
    //       // Calculate the start and end indices of the current node in the source code
    //       const { start, end } = path.node.loc;
    //       // Check if the end index falls within the current node's range
    //       if (end.index >= documentCursorOffset) {
    //         foundNode = path.node;
    //       }
    //     },
    //   });
    //   console.log("foundNode", foundNode);
    //   traverse(ast, {
    //     ReturnStatement: function (path: any) {
    //       // Check if the target node is inside this ReturnStatement
    //       if (
    //         path.node.loc.start <= foundNode.loc.start &&
    //         path.node.loc.end >= foundNode.loc.end
    //       ) {
    //         returnStatementParent = path.node;
    //         parentPathOfReturnStatement = path.parent;
    //         path.stop(); // Stop traversal since we found the ReturnStatement
    //       }
    //     },
    //   });
    // }
  }
}
