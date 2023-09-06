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

      const code = document.getText();

      const importsUsed = importsToArray(code);
      const importsToAdd = findObjectsNotInArray(imports, importsUsed);

      const importStatements = arrayToImports(importsToAdd);

      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        document.uri,
        new vscode.Position(0, 0),
        importStatements + "\n\n"
      );
      await vscode.workspace.applyEdit(edit);
    }
  }

  // Start the traversal by calling the function with the root of the AST

  private async addVariableStatements(
    variableStatements: string
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;
      const code = document.getText();

      const selection = editor.selection;
      const cursorPosition = selection.active;
      const documentCursorOffset = document.offsetAt(cursorPosition) - 1;
      let foundNode: any = null;
      let functionNotFound = true;

      const ast = parser.parse(code, {
        sourceType: "module", // Specify 'module' for ES modules or 'script' for non-module code
        plugins: ["jsx", "typescript"],
      });

      // find the node that the cursor is in
      traverse(ast, {
        enter(path: any) {
          // Calculate the start and end indices of the current node in the source code
          const { end } = path.node.loc;
          // Check if the end index falls within the current node's range
          if (end.index >= documentCursorOffset) {
            foundNode = path.node;
          }
        },
      });

      const functionNode = traverseNode(ast, foundNode);

      if (!functionNode) {
        return;
      }

      // Traverse the AST to find the target node (e.g., a function declaration)
      traverse(ast, {
        ArrowFunctionExpression(path) {
          // You can conditionally select the node where you want to prepend text.
          // For example, here we are targeting the "myFunction" function.
          if (path.node === functionNode) {
            // Add text to the function's body
            // functionNotFound = false;
            prependTextToNode(path.node, variableStatements);
          } else {
            functionNotFound = true;
          }
        },
      });

      // if (functionNotFound) {
      //   prependTextToNode(ast, variableStatements);
      // }

      const modifiedCode = generate(ast).code;

      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        new vscode.Position(0, 0), // Start position
        document.positionAt(document.getText().length) // End position (line count represents the entire file)
      );

      edit.replace(document.uri, range, modifiedCode);

      await vscode.workspace.applyEdit(edit);
    }
  }
}

function prependTextToNode(node: any, textToPrepend: any) {
  if (node.body.body) {
    // Add the text to the beginning of the body
    node.body.body.unshift(parser.parse(textToPrepend).program.body[0]);
  }
}

function traverseNode(node: any, targetNode: any) {
  if (!node) {
    return null;
  }

  if (node === targetNode) {
    return null; // We don't want to return the current node itself
  }

  for (const key in node) {
    if (node.hasOwnProperty(key) && typeof node[key] === "object") {
      const result: any = traverseNode(node[key], targetNode);
      if (result) {
        return result; // Return the last ancestor ArrowFunctionExpression found
      }
    }
  }

  if (node.type === "ArrowFunctionExpression") {
    if (hasDescendant(node, targetNode)) {
      return node; // Return the ArrowFunctionExpression with the descendant
    }
    return null;
  }

  // If no matching ancestor is found, return null
  return null;
}

// improve later for particular descendant
function hasDescendant(node: any, targetNode: any) {
  if (node === targetNode) {
    return true;
  }

  for (const key in node) {
    if (node.hasOwnProperty(key) && typeof node[key] === "object") {
      if (hasDescendant(node[key], targetNode)) {
        return true;
      }
    }
  }

  return false;
}

function importsToArray(fileContent: any) {
  const importDetails: any = [];
  const ast = parser.parse(fileContent, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  traverse(ast, {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ImportDeclaration(path) {
      const { specifiers, source } = path.node;
      const importFrom = source.value;

      specifiers.forEach((specifier: any) => {
        const importName = specifier?.imported?.name || specifier?.local?.name;
        const importType =
          specifier.type === "ImportDefaultSpecifier" ||
          specifier.local.name === "default"
            ? "default"
            : "named";
        const importAs =
          specifier.type === "ImportDefaultSpecifier" ||
          specifier.local.name === importName
            ? null
            : specifier.local.name;

        importDetails.push({
          importName,
          importType,
          importAs,
          importFrom,
        });
      });
    },
  });

  return importDetails;
}

function arrayToImports(importDetails: any): string {
  const groupedImports: any = {};

  // Group imports by importFrom
  for (const detail of importDetails) {
    const { importFrom } = detail;
    if (!groupedImports[importFrom]) {
      groupedImports[importFrom] = [];
    }
    groupedImports[importFrom].push(detail);
  }

  const importStrings: string[] = [];

  // Generate import statements for each group
  for (const importFrom in groupedImports) {
    const imports = groupedImports[importFrom];
    const namedImports = imports.filter(
      (detail: any) => detail.importType === "named"
    );
    const defaultImport = imports.find(
      (detail: any) => detail.importType === "default"
    );

    if (imports.length === 1) {
      // Single import, no need to group
      const [detail] = imports;
      if (detail.importType === "default") {
        // Default import
        importStrings.push(
          `import ${detail.importAs || detail.importName} from '${importFrom}';`
        );
      } else {
        // Named import
        const importName = detail.importAs
          ? `${detail.importName} as ${detail.importAs}`
          : detail.importName;
        importStrings.push(`import { ${importName} } from '${importFrom}';`);
      }
    } else {
      // Group multiple imports from the same source
      const importStatementParts = [];

      if (defaultImport) {
        // Default import
        importStatementParts.push(
          `${defaultImport.importName}${namedImports.length > 0 ? "," : ""}`
        );
      }

      if (namedImports.length > 0) {
        // Named imports
        const groupedImportNames = namedImports
          .map((detail: any) =>
            detail.importAs
              ? `${detail.importName} as ${detail.importAs}`
              : detail.importName
          )
          .join(", ");

        importStatementParts.push(`{ ${groupedImportNames} }`);
      }

      importStatementParts.push(`from '${importFrom}';`);

      importStrings.push(`import ${importStatementParts.join(" ")}\n`);
    }
  }

  return importStrings.join("");
}

function findObjectsNotInArray(a1: any, a2: any) {
  // Use filter to keep objects from a1 that are not in a2
  const objectsNotInA2 = a1.filter((objA1: any) => {
    // Use some to check if objA1 is not in a2
    return !a2.some((objA2: any) => {
      // Compare objects based on their properties
      return (
        objA1.importName === objA2.importName &&
        objA1.importType === objA2.importType &&
        objA1.importAs === objA2.importAs &&
        objA1.importFrom === objA2.importFrom
      );
    });
  });

  return objectsNotInA2;
}
