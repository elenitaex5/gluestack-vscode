import * as fs from "fs";
import * as path from "path";
import * as json5 from "json5";
import { execSync, spawn } from "child_process";

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

function checkoutBranch(repoPath: any, branchName: any) {
  const command = `git -C ${repoPath} checkout ${branchName}`;

  try {
    const output = execSync(command).toString();
  } catch (error) {}
}

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

function findAllStoriesFiles(tmpPath: string, docsPath: string) {
  const pattern = "^(?!.*.(stories.tsx|mdx)$).*$"; // RegExp to match the pattern

  const foundFiles = findFilesWithPatternOnPath(docsPath, pattern);
  // read the content of these found files
  fetchSnippetsFromFiles(foundFiles);
}

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

// working
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

// function fixComponentValue(input: string, componentName: string): string {
//   // Add quotes around component value
//   const fixedComponent = input.replace(
//     new RegExp(`(component:\\s*)(${componentName})(\\s*,|\\n|\\s*})`, "g"),
//     '$1"$2"$3'
//   );

//   return fixedComponent;
// }

function fetchSnippetsFromFiles(foundFiles: string[]) {
  for (let i = 0; i < foundFiles?.length; i++) {
    const argumentFile = findFileWithExtensionInSameDirectory(
      foundFiles[i],
      ".stories.tsx"
    );

    let argumentFileContent = "";
    let componentName = "";
    const snippetFileContent = fs.readFileSync(foundFiles[i], "utf8");
    const defaultExportedName = fetchDefaultExportedName(snippetFileContent);
    if (argumentFile.length !== 0 && defaultExportedName) {
      componentName = path.basename(argumentFile[0]).split(".")[0];
      argumentFileContent = getArgumentFileContent(
        argumentFile[0],
        componentName
      );
      const argumentFileValidJson = makeValidJSON(argumentFileContent);
      const argumentFileJson = JSON.parse(argumentFileValidJson);
      const matchedReturnedSnippet =
        findMatchedReturnedSnippet(snippetFileContent);
      const allCombinationsOfProps = findAllCombinationProps(
        argumentFileJson,
        componentName
      );
      findAllCombinationsAndReplaceProps(
        allCombinationsOfProps,
        matchedReturnedSnippet,
        defaultExportedName,
        foundFiles[i]
      );
    }
  }
}

function findAllCombinationsAndReplaceProps(
  combinations: any,
  snippet: string,
  defaultExportedNameInSnippet: string,
  filePath: string
) {
  for (const data in combinations) {
    const spreadedPropsString = convertToString(combinations[data]);
    // console.log("***", spreadedPropsString, "***");
    const replacedPropSnippet = snippet.replace(
      `{...props}`,
      spreadedPropsString
    );
    saveDataToSnippets(
      data,
      replacedPropSnippet,
      defaultExportedNameInSnippet,
      filePath
    );
  }
}

function saveDataToSnippets(
  combinationDataKey: any,
  combinationSnippet: any,
  defaultExportedName: any,
  file: any
) {
  // const fileName = path.basename(file, ".tsx");

  const newComponent = {
    completion: defaultExportedName + combinationDataKey,
    imports: ["NewComponent"],
    template: combinationSnippet,
  };

  let fileContent = fs.readFileSync(destinationPath, "utf8");
  let jsonParsed = json5.parse(fileContent);
  jsonParsed[defaultExportedName + combinationDataKey] = newComponent;
  // read the data from the file and then push this new data to it
  fs.writeFileSync(destinationPath, JSON.stringify(jsonParsed, null, 2));
}

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

function findMatchedReturnedSnippet(fileContent: any) {
  // Use the match method to find the first match
  const pattern = /return\s*\(([\s\S]*?)\);/;
  return fileContent.match(pattern)?.length > 1
    ? fileContent.match(pattern)[1]
    : "";
}

function fetchDefaultExportedName(fileContent: any) {
  // Use a regular expression to find the default export
  const defaultExportRegex = /export default\s+(.*?);/s;
  const defaultExportMatch = fileContent.match(defaultExportRegex);

  if (defaultExportMatch) {
    return defaultExportMatch[1].trim();
  } else {
    console.log("Default export not found.");
  }
}

function convertObjectStringToObject(input: string): any {
  // Remove line breaks and spaces after colons
  const cleanedInput = input.replace(/:\s+/g, ":");

  // Replace single quotes with double quotes
  const doubleQuotedInput = cleanedInput.replace(/'/g, '"');

  // Parse the JSON object
  const parsedObject = JSON.parse(doubleQuotedInput);

  // Convert all values to strings recursively
  function convertValuesToStrings(obj: any): any {
    if (typeof obj === "object") {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === "object") {
            obj[key] = convertValuesToStrings(obj[key]);
          } else {
            obj[key] = String(obj[key]);
          }
        }
      }
    }
    return obj;
  }

  const convertedObject = convertValuesToStrings(parsedObject);
  return convertedObject;
}

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
