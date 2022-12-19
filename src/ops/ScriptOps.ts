import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { applyNameCollisionPolicy } from './utils/OpsUtils';
import {
  createProgressIndicator,
  createTable,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  getScriptByName,
  getScripts,
  putScript,
  Script,
} from '../api/ScriptApi';
import wordwrap from './utils/Wordwrap';
import {
  convertBase64TextToArray,
  convertTextArrayToBase64,
  getTypedFilename,
  readFilesRecursive,
  saveTextToFile,
  saveToFile,
  titleCase,
  validateImport,
} from './utils/ExportImportUtils';
import * as state from '../shared/State';
import { decode, encode } from '../api/utils/Base64';

type SavedScript = Omit<Script, 'script'> & { script: string[] };
/**
 * List scripts
 */
export async function listScripts(long = false) {
  try {
    const scripts = (await getScripts()).result;

    scripts.sort((a, b) => a.name.localeCompare(b.name));
    if (long) {
      const table = createTable([
        'Name',
        'UUID',
        'Language',
        'Context',
        'Description',
      ]);
      const langMap = { JAVASCRIPT: 'JS', GROOVY: 'Groovy' };
      scripts.forEach((script) => {
        table.push([
          wordwrap(script.name, 25, '  '),
          script._id,
          langMap[script.language],
          wordwrap(titleCase(script.context.split('_').join(' ')), 25),
          wordwrap(script.description, 30),
        ]);
      });
      printMessage(table.toString(), 'data');
    } else {
      scripts.forEach((script) => {
        printMessage(`${script.name}`, 'data');
      });
    }
  } catch (error) {
    printMessage(`Error listing scripts - ${error}`, 'error');
  }
}

/**
 * Export script to file
 * @param {String} name script name
 * @param {String} file file name
 */
export async function exportScriptByName(name, file) {
  let fileName = getTypedFilename(name, 'script');
  if (file) {
    fileName = file;
  }
  const scriptData = (await getScriptByName(name)).result;
  if (scriptData.length > 1) {
    printMessage(`Multiple scripts with name ${name} found...`, 'error');
  }
  const scriptsToSave: SavedScript[] = scriptData.map((element) => {
    const scriptTextArray = convertBase64TextToArray(element.script);
    // eslint-disable-next-line no-param-reassign

    return {
      ...element,
      script: scriptTextArray,
    };
  });
  saveToFile('script', scriptsToSave, '_id', fileName);
}

/**
 * Export all scripts to single file
 * @param {String} file file name
 */
export async function exportScriptsToFile(file) {
  let fileName = getTypedFilename(`all${state.getRealm()}Scripts`, 'script');
  if (file) {
    fileName = file;
  }
  const scriptList = (await getScripts()).result;
  const allScriptsData: SavedScript[] = [];
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);
    // eslint-disable-next-line no-await-in-loop
    const scriptData = (await getScriptByName(item.name)).result;
    scriptData.forEach((element) => {
      const scriptTextArray = convertBase64TextToArray(element.script);
      allScriptsData.push({
        ...element,
        script: scriptTextArray,
      });
    });
  }
  stopProgressIndicator('Done');
  saveToFile('script', allScriptsData, '_id', fileName);
}

/**
 * Export all scripts to individual files
 */
export async function exportScriptsToFiles() {
  const scriptList = (await getScripts()).result;
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);
    // eslint-disable-next-line no-await-in-loop
    const scriptData = (await getScriptByName(item.name)).result;
    const scriptsToSave = scriptData.map((element) => {
      const scriptTextArray = convertBase64TextToArray(element.script);
      return {
        ...element,
        script: scriptTextArray,
      };
    });
    const fileName = getTypedFilename(item.name, 'script');
    saveToFile('script', scriptsToSave, '_id', fileName);
  }
  stopProgressIndicator('Done');
}

/**
 * Export all scripts to 2 files: one script file and one metadata file
 */
export async function exportScriptsExtract() {
  const scriptList = (await getScripts()).result;
  createProgressIndicator(scriptList.length, 'Exporting script');
  for (const item of scriptList) {
    updateProgressIndicator(`Reading script ${item.name}`);
    // eslint-disable-next-line no-await-in-loop
    const scriptData = (await getScriptByName(item.name)).result;
    scriptData.forEach((element) => {
      const fileExtension = element.language === 'JAVASCRIPT' ? 'js' : 'groovy';
      const scriptFileName = getTypedFilename(
        element.name,
        'script',
        fileExtension
      );

      const scriptText = decode(element.script);
      element.script = scriptFileName;

      saveTextToFile(scriptText, scriptFileName);
    });
    const fileName = getTypedFilename(item.name, 'meta');
    saveToFile('script', scriptData, '_id', fileName);
  }
  stopProgressIndicator('Done');
}

/**
 * Import script
 * @param {String} id script uuid
 * @param {Object} data script object
 * @returns {Object} a status object
 */
export async function createOrUpdateScript(id, data) {
  try {
    await putScript(id, data);
    return { error: false, name: data.name };
  } catch (e) {
    if (e.response?.status === 409) {
      printMessage(
        `createOrUpdateScript WARNING: script with name ${data.name} already exists, using renaming policy... <name> => <name - imported (n)>`,
        'warn'
      );
      const newName = applyNameCollisionPolicy(data.name);
      // console.log(newName);
      printMessage(`Trying to save script as ${newName}`, 'warn');
      // eslint-disable-next-line no-param-reassign
      data.name = newName;
      await createOrUpdateScript(id, data);
      return { error: false, name: data.name };
    }
    printMessage(
      `createOrUpdateScript ERROR: put script error, script ${id} - ${e.message}`,
      'error'
    );
    return { error: true, name: data.name };
  }
}

export async function importScriptsFromFile(name, file, reUuid = false) {
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) throw err;
    const scriptData = JSON.parse(data);
    if (validateImport(scriptData.meta)) {
      createProgressIndicator(Object.keys(scriptData.script).length, '');
      for (const existingId in scriptData.script) {
        if ({}.hasOwnProperty.call(scriptData.script, existingId)) {
          let newId = existingId;
          // console.log(id);
          const encodedScript = convertTextArrayToBase64(
            scriptData.script[existingId].script
          );
          scriptData.script[existingId].script = encodedScript;
          if (reUuid) {
            newId = uuidv4();
            // printMessage(
            //   `Re-uuid-ing script ${scriptData.script[existingId].name} ${existingId} => ${newId}...`
            // );
            scriptData.script[existingId]._id = newId;
          }
          if (name) {
            // printMessage(
            //   `Renaming script ${scriptData.script[existingId].name} => ${options.script}...`
            // );
            scriptData.script[existingId].name = name;
          }
          updateProgressIndicator(
            `Importing ${scriptData.script[existingId].name}`
          );
          // console.log(scriptData.script[id]);
          createOrUpdateScript(newId, scriptData.script[existingId]).then(
            (result) => {
              if (result == null)
                printMessage(
                  `Error importing ${scriptData.script[existingId].name}`,
                  'error'
                );
            }
          );
          if (name) break;
        }
      }
      stopProgressIndicator('Done');
      // printMessage('Done');
    } else {
      printMessage('Import validation failed...', 'error');
    }
  });
}

export async function importExtractedScripts() {
  const files = await readFilesRecursive('.');
  const metaFiles = files.filter((file) => file.endsWith('.meta.json'));
  createProgressIndicator(metaFiles.length, 'Importing scripts');
  for (const metaFile of metaFiles) {
    updateProgressIndicator(`Reading ${metaFile}`);
    const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8')) as Script;
    const scriptFileName = metaData.script;
    const scriptData = fs.readFileSync(scriptFileName, 'utf8');
    const encodedScript = encode(scriptData);
    metaData.script = encodedScript;
    await createOrUpdateScript(metaData._id, metaData);
  }
  stopProgressIndicator('Done');
}
