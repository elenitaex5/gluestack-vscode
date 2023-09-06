import * as fs from "fs";
import * as path from "path";
import * as json5 from "json5";
import { execSync, spawn } from "child_process";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";

const currPath = path.resolve(__dirname);
const rootPath = path.resolve(path.join(currPath, "..", "..", "..", ".."));

const configFile = "./storybook-to-snippet.config.json";
const config = require(path.resolve(__dirname, configFile));

let repoConfig: any = {};
let destinationPath = "";
let repoPath = "";
let docsPath = "";
const reposDirectoryPath = path.join(rootPath, "tmp");
main();
// main function to execute while executing this script
export default function main() {
  //loop through all the repos
  for (const repo of config.repos) {
    //get all the config for the repo and save in global variable
    repoConfig = repo;

    // fill in all global variables to use in the functions

    repoPath = path.join(reposDirectoryPath, repo.repoName);
    docsPath = path.join(repoPath, repo.docsPath);

    // fill in all global variables to use in the functions
    destinationPath = path.join(__dirname, repo.destinationPath);
    updateSnippetsFromStorybook();
    createSnippetsFile(destinationPath);
  }
}

function createSnippetsFile(destinationPath: string) {
  try {
    // Read JSON content
    const jsonContent = fs.readFileSync(destinationPath, "utf8");

    // Create TypeScript content
    const tsContent = `export default ${jsonContent};`;

    // Create .ts file path
    const tsFilePath = destinationPath.replace(".json", ".ts");

    // Write TypeScript content to .ts file
    fs.writeFileSync(tsFilePath, tsContent, "utf8");

    console.log("TypeScript file created successfully.");
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

function updateSnippetsFromStorybook() {
  // if (fs.existsSync(reposDirectoryPath)) {
  //   cleanUp(reposDirectoryPath);
  // }
  // createFolders(reposDirectoryPath);
  // cloneRepoSrc();
  findAllStoriesFiles(reposDirectoryPath, docsPath);
}

// delete directory recursively whenever required
function cleanUp(pathX: string) {
  let files = fs.readdirSync(pathX);
  for (let i = 0; i < files?.length; i++) {
    const fileDir = path.join(pathX, files[i]);
    if (!fileDir.includes(".gitignore")) {
      fs.rmSync(fileDir, {
        recursive: true,
        force: true,
      });
    }
  }
  console.log("Cleaned Up ", path);
}

// create folders recursively whenever required
function createFolders(pathx: string) {
  const parts = pathx.split("/");
  let currentPath = "";

  parts.forEach((part) => {
    currentPath += part + "/";
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath);
    }
  });
}

// clone repo from git, it will checkout to the specified branch and delete all the ignored paths as well
async function cloneRepoSrc() {
  execSync("git clone " + repoConfig.gitUrl, {
    stdio: [0, 1, 2], // we need this so node will print the command output
    cwd: reposDirectoryPath, // path to where you want to save the file
  });
  // Checkout to specified branch
  checkoutBranch(repoPath, repoConfig.branchName);

  // Delete all the ignored paths
  deleteIgnoredPaths(docsPath, repoConfig.ignoredPaths);
}

// function to checkout to the specified branch: used in cloneRepoSrc function
function checkoutBranch(repoPath: any, branchName: any) {
  const command = `git -C ${repoPath} checkout ${branchName}`;

  try {
    const output = execSync(command).toString();
  } catch (error) {}
}

// function to delete all the ignored paths: used in cloneRepoSrc function
function deleteIgnoredPaths(srcDir: any, paths: any) {
  try {
    for (let i = 0; i < paths?.length; i++) {
      let fileOrFolderPath = path.join(srcDir, paths[i]);
      if (fs.existsSync(fileOrFolderPath)) {
        if (fs.statSync(fileOrFolderPath).isDirectory()) {
          fs.rmSync(fileOrFolderPath, {
            recursive: true,
            force: true,
          });
        } else {
          fs.unlinkSync(fileOrFolderPath);
        }
      }
    }
  } catch (err) {
    console.log("ERROR:" + err);
  }
}

// TODO: NEED TO FIX THE STORIES IN THE STORYBOOK
// now the main function to find all the stories files and then fetch the snippets from them
function findAllStoriesFiles(tmpPath: string, docsPath: string) {
  const pattern = "^(?!.*.(stories.tsx|mdx)$).*$"; // RegExp to match the pattern

  const foundFiles = findFilesWithPatternOnPath(docsPath, pattern);
  // read the content of these found files
  fetchSnippetsFromFiles(foundFiles);
}

// actual function to find the files with the pattern i.e. files except stories.tsx and mdx
function findFilesWithPatternOnPath(startPath: string, pattern: string) {
  const result: any = [];

  function findFilesRecursive(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = path.join(currentPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        findFilesRecursive(filePath);
      } else if (stats.isFile() && file.match(pattern)) {
        result.push(filePath);
      }
    });
  }

  findFilesRecursive(startPath);
  return result;
}

// fetch the actual snippets from the files to be used in the snippets file
// pseudo code
// 1. traverse over all the files and find the stories files that don't have extension .stories.tsx or .mdx
// 2. then find the .stories.tsx file in the same directory
// 3. find the default exported name from the .tsx file
// 4. read the .stories.tsx file and get the arguments to make combinations of the props
// 5. properly format the arguments to make valid json
// 6. make all the combinations of the props
// 7. get the snippet from the .tsx file, currently getting return part from the file using regex
// 8. replace combinations of props in the snippet function
function fetchSnippetsFromFiles(foundFiles: string[]) {
  for (let i = 0; i < foundFiles?.length; i++) {
    const argumentFile = findFileWithExtensionInSameDirectory(
      foundFiles[i],
      ".stories.tsx"
    );

    let argumentFileContent = "";
    let componentName = "";
    const snippetFileContent = fs.readFileSync(foundFiles[i], "utf8");
    const defaultExportedName: any =
      fetchDefaultExportedName(snippetFileContent);

    let defaultExportedComponent: any = "";
    let variableStatements: any = "";
    const importsUsed = importsToArray(snippetFileContent);

    if (defaultExportedName) {
      defaultExportedComponent = extractdefaultExportedComponent(
        snippetFileContent,
        defaultExportedName
      );

      variableStatements = findVariableStatements(
        defaultExportedComponent,
        defaultExportedName
      );
    }
    if (argumentFile.length !== 0 && defaultExportedName) {
      componentName = path.basename(argumentFile[0]).split(".")[0];
      argumentFileContent = getArgumentFileContent(
        argumentFile[0],
        componentName
      );
      const argumentFileValidJson = makeValidJSON(argumentFileContent);
      const argumentFileJson = JSON.parse(argumentFileValidJson);
      const matchedReturnedSnippet = findMatchedReturnedSnippet(
        defaultExportedComponent
      );
      const allCombinationsOfProps = findAllCombinationProps(
        argumentFileJson,
        componentName
      );
      replaceCombinationsOfProps(
        allCombinationsOfProps,
        matchedReturnedSnippet,
        defaultExportedName,
        foundFiles[i],
        importsUsed,
        variableStatements
      );
    }
  }
}

// function to find the file with the extension in the same directory
function findFileWithExtensionInSameDirectory(
  filepath: string,
  extension: string
) {
  const directoryPath = path.dirname(filepath);

  try {
    const matchingFiles = fs
      .readdirSync(directoryPath)
      .filter((filename) => filename.endsWith(extension))
      .map((filename) => path.join(directoryPath, filename));

    return matchingFiles;
  } catch (error: any) {
    console.error("Error:", error.message);
    return [];
  }
}

function fetchDefaultExportedName(fileContent: any) {
  const ast = parser.parse(fileContent, {
    sourceType: "module", // Specify 'module' for ES modules or 'script' for non-module code
    plugins: ["jsx", "typescript"],
  });

  let exportAssignmentName = null;

  // Traverse the AST to find the export assignment
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      // Check if it's an export default declaration with an Identifier
      if (path.node.declaration.type === "Identifier") {
        exportAssignmentName = path.node.declaration.name;
        // Stop traversal as we found the export assignment
        path.stop();
      }
    },
  });
  if (exportAssignmentName === null) {
    console.log("No export assignment found in the code.");
  } else {
    return exportAssignmentName;
  }
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

function extractdefaultExportedComponent(
  fileContent: any,
  defaultExportedName: string
) {
  // Parse the code using the Babel parser
  const ast = parser.parse(fileContent, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  let declarationStatement: any = null;
  // Traverse the AST to find the variable declaration
  traverse(ast, {
    VariableDeclaration(path) {
      const declarations: any = path.node.declarations;
      for (const declaration of declarations) {
        if (declaration.id.name === defaultExportedName) {
          declarationStatement = path.toString();
          path.stop();
          break;
        }
      }
    },
    FunctionDeclaration(path) {
      if (path.node.id && path.node.id.name === defaultExportedName) {
        declarationStatement = path.toString();
        path.stop();
      }
    },
  });

  return declarationStatement;
}

function findVariableStatements(
  defaultExportedComponent: any,
  defaultExportedName: string
) {
  const ast = parser.parse(defaultExportedComponent, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const variableStatements: any = [];

  traverse(ast, {
    VariableDeclaration(path) {
      // Get the kind of declaration (let, const, var)
      const declarationKind = path.node.kind;

      // Loop through the declarations within this statement
      path.node.declarations.forEach((declaration: any) => {
        // Extract the entire variable declaration as it is
        const variableDeclaration = generate(declaration).code;

        // Check if the variable declaration contains the defaultExportedName
        if (!variableDeclaration.includes(defaultExportedName)) {
          // Push the entire variable declaration to the list
          variableStatements.push(declarationKind + " " + variableDeclaration);
        }
      });
    },
  });

  if (variableStatements.length > 0) {
    return variableStatements.join("\n");
  }
  return "";
}

function getArgumentFileContent(argumentFilePath: any, componentName: any) {
  const content = fs.readFileSync(argumentFilePath, "utf8");
  const pattern = new RegExp(
    `const ${componentName}Meta: ComponentMeta<typeof ${componentName}> = ({[\\s\\S]*?});`
  );
  const match = content.match(pattern);
  if (match) {
    const metaJson = match[1];
    return metaJson;
  }
  return "";
}

// TODO: NEED TO FIX THIS FUNCTION
// make a valid json from js object
function makeValidJSON(input: string): string {
  const jsonStringWithQuotes = input.replace(
    /'([^']+)'|"([^"]+)"/g,
    (_, singleQuotes, doubleQuotes) => {
      return `"${singleQuotes || doubleQuotes}"`;
    }
  );

  // Add quotes around component value
  const fixedComponent = jsonStringWithQuotes.replace(
    /component:\s*([^,\s]+)/g,
    'component: "$1"'
  );

  // Replace unquoted property names with quoted property names
  const quotedProps = fixedComponent.replace(
    /([{,]\s*)([a-zA-Z_]\w*)(\s*:)/g,
    '$1"$2"$3'
  );

  // Remove trailing commas from object's last child or array's last element
  const validJSON = quotedProps.replace(/,(\s*[}\]])/g, "$1");
  return validJSON;
}

function findMatchedReturnedSnippet(fileContent: any) {
  const ast = parser.parse(fileContent, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  let returnStatementCode: string | null = "";

  traverse(ast, {
    ArrowFunctionExpression(path) {
      // Find the ArrowFunctionExpression representing the component.
      if (path.node.params.length > 0) {
        const firstParam = path.node.params[0];
        if (firstParam.type === "ObjectPattern") {
          // Check if the first parameter is an ObjectPattern (props).
          const returnStatement = path
            .get("body")
            .get("body")
            .find((node) => {
              return node.type === "ReturnStatement";
            });

          if (returnStatement) {
            // Extract the code inside the return statement.
            returnStatementCode =
              returnStatement.get("argument").toString() || null;
          }
        }
      }
    },
  });

  if (returnStatementCode) {
    // Print the extracted code.
    return returnStatementCode.replace(/([$])/g, "\\$1");
  }
  return "";
}

// replace combinations of props in the snippet
// pseudo code
// 1. loop over all the combinations of props
// 2. create speaded props string from the combination
// 3. replace the spreaded props string in the snippet
// 4. save the snippet in the snippets file
function replaceCombinationsOfProps(
  combinations: any,
  snippet: string,
  defaultExportedNameInSnippet: string,
  filePath: string,
  importsUsed: any,
  variableStatements: any
) {
  for (const data in combinations) {
    const spreadedPropsString = convertToString(combinations[data]);
    const replacedPropSnippet = snippet.replace(
      `{...props}`,
      spreadedPropsString
    );
    saveDataToSnippets(
      data,
      replacedPropSnippet,
      defaultExportedNameInSnippet,
      filePath,
      importsUsed,
      variableStatements
    );
  }
}

// save the snippet in the snippets file
// pseudo code
// type of data to be saved in the snippets file
// { "defaultExportedName + combinationDataKey" :{ completion"defaultExportedName + combinationDataKey",imports:"", template:"snippet" } }

function saveDataToSnippets(
  combinationDataKey: any,
  combinationSnippet: any,
  defaultExportedName: any,
  file: any,
  importsUsed: any,
  variableStatements: any
) {
  let newCombinationDataKey = combinationDataKey;
  let tempCombinationDataKey = combinationDataKey.split("-");

  if (tempCombinationDataKey.length > 1) {
    tempCombinationDataKey.shift(); // Remove the first element
    newCombinationDataKey = tempCombinationDataKey.join("-");
  }

  const newComponent = {
    completion: defaultExportedName + "-" + newCombinationDataKey,
    imports: importsUsed,
    template: combinationSnippet,
    variableStatements: variableStatements,
  };

  let fileContent = fs.readFileSync(destinationPath, "utf8");
  let jsonParsed = json5.parse(fileContent);
  jsonParsed[defaultExportedName + "-" + newCombinationDataKey] = newComponent;
  // read the data from the file and then push this new data to it
  fs.writeFileSync(destinationPath, JSON.stringify(jsonParsed, null, 2));
}

// convert object to spreaded string
function convertToString(data: any) {
  if (typeof data !== "object" || Array.isArray(data)) {
    return "Invalid input. Please provide an object.";
  }

  const convertedParts = [];
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      convertedParts.push(`${key}="${data[key]}"`);
    }
  }

  const convertedString = convertedParts.join(" ");
  return convertedString;
}

// function to find all the combinations of the props
function findAllCombinationProps(argumentsJson: any, componentName: string) {
  const StoryArgs = argumentsJson;
  const options = StoryArgs.argTypes;
  const combinations: any = [];
  const allCombinations: any = [];
  const combinationData: any = {};
  const STATE_PROPERTIES = [
    "isHovered",
    "isPressed",
    "isFocused",
    "isFocusVisible",
    "isDisabled",
    "isInvalid",
    "isReadonly",
    "isRequired",
  ];

  if (options) {
    const filteredOptions = { ...options };
    STATE_PROPERTIES.forEach((state) => {
      delete filteredOptions[state];
    });

    generateCombinations(combinations, filteredOptions, 0, {});
  }
  combinations.forEach((combination: any) => {
    STATE_PROPERTIES.forEach((state) => {
      if (Object.keys(options).includes(state)) {
        const newStateCombination: any = { ...combination };
        newStateCombination[state] = true;
        allCombinations.push(newStateCombination);
      }
    });
    allCombinations.push({ ...combination });
  });

  allCombinations.map((props: any, index: any) => {
    const x: any = { ...props };

    STATE_PROPERTIES.forEach((state) => {
      if (x[state]) {
        delete x[state];
      }
    });

    let name = componentName;

    Object.keys(x).map((prop) => {
      if (
        prop !== "component-name" &&
        prop !== "state" &&
        StoryArgs.args[prop] !== x[prop]
      ) {
        name += "-" + x[prop];
      }
    });
    combinationData[name] = x;
  });
  return combinationData;
}

function generateCombinations(
  combinations: any,
  options: any,
  index: number,
  combination: any
) {
  if (index === Object.keys(options).length) {
    combinations.push(combination);
    return;
  }

  const optionKey = Object.keys(options)[index];
  const optionValues = options[optionKey].options;

  if (
    optionValues &&
    optionValues.length > 0 &&
    !options[optionKey].figmaIgnore
  ) {
    for (let i = 0; i < optionValues.length; i++) {
      const newCombination = { ...combination };

      newCombination[optionKey] = optionValues[i];
      generateCombinations(combinations, options, index + 1, newCombination);
    }
  } else {
    generateCombinations(combinations, options, index + 1, combination);
  }
}
