import * as vscode from "vscode";
import { COMPONENT_COMPLETIONS } from "./COMPONENT_COMPLETIONS";

class GluestackCompletionProvider implements vscode.CompletionItemProvider {
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
      // @ts-ignore
      return undefined;
    }

    // Compute the start position of "gs-"
    const startPos = position.translate(0, -3); // Move 3 characters to the left

    // Generate completion items from the structured object
    const completionItems = Object.values(COMPONENT_COMPLETIONS).map(
      (component) => {
        const completionItem = new vscode.CompletionItem(
          component.completion,
          vscode.CompletionItemKind.Class
        );
        completionItem.insertText = component.template;
        completionItem.additionalTextEdits = [
          vscode.TextEdit.replace(new vscode.Range(startPos, position), ""),
        ];
        completionItem.command = {
          command: "gluestack-vscode.handleInsertImport",
          title: "Insert Import",
          arguments: [component.imports],
        };
        return completionItem;
      }
    );

    // @ts-ignore
    return completionItems;
  }
}

function handleInsertImport(imports: string[]) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  let importStatement = `import { ${imports.join(
    ", "
  )} } from "@gluestack-ui/react";\n`;

  // Check if import from @gluestack-ui/react already exists
  for (let line = 0; line < document.lineCount; line++) {
    const lineText = document.lineAt(line).text;
    if (lineText.includes("@gluestack-ui/react")) {
      // If import already exists, modify the existing line
      importStatement = lineText.replace("}", `, ${imports.join(", ")} }`);
      editor.edit((edit) => {
        edit.replace(document.lineAt(line).range, importStatement);
      });
      return;
    }
  }

  // If no existing import, add it to the top
  editor.edit((edit) => {
    edit.insert(new vscode.Position(0, 0), importStatement);
  });
}

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "gluestack-vscode" is now active!'
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "javascript",
      new GluestackCompletionProvider(),
      "g",
      "s",
      "-"
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gluestack-vscode.handleInsertImport",
      handleInsertImport
    )
  );

  let disposable = vscode.commands.registerCommand(
    "gluestack-vscode.helloWorld",
    () => {
      vscode.window.showInformationMessage(
        "Hello Test World from gluestack-vscode!"
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
