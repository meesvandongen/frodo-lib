/* eslint-disable no-await-in-loop */
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import propertiesReader from 'properties-reader';
import replaceall from 'replaceall';
import {
  getAllConfigEntities,
  getConfigEntity,
  putConfigEntity,
  queryAllManagedObjectsByType,
} from '../api/IdmConfigApi';
import {
  createProgressIndicator,
  printMessage,
  stopProgressIndicator,
} from './utils/Console';
import { getTypedFilename } from './utils/ExportImportUtils';
import { readFiles, unSubstituteEnvParams } from './utils/OpsUtils';
import { validateScriptHooks } from './utils/ValidationUtils';

/**
 * List all IDM configuration objects
 */
export async function listAllConfigEntities() {
  let configEntities = [];
  try {
    configEntities = await getAllConfigEntities();
  } catch (getAllConfigEntitiesError) {
    printMessage(getAllConfigEntitiesError, 'error');
    printMessage(
      `Error getting config entities: ${getAllConfigEntitiesError}`,
      'error'
    );
  }
  if ('configurations' in configEntities) {
    configEntities['configurations'].forEach((configEntity) => {
      printMessage(`${configEntity._id}`, 'data');
    });
  }
}

/**
 * Export an IDM configuration object.
 * @param {String} id the desired configuration object
 * @param {String} file optional export file
 */
export async function exportConfigEntity(id, file) {
  let fileName = file;
  if (!fileName) {
    fileName = getTypedFilename(`${id}`, 'idm');
  }
  const configEntity = await getConfigEntity(id);
  fs.writeFile(fileName, JSON.stringify(configEntity, null, 2), (err) => {
    if (err) {
      return printMessage(`ERROR - can't save ${id} export to file`, 'error');
    }
    return '';
  });
}

/**
 * Export all IDM configuration objects into separate JSON files in a directory specified by <directory>
 * @param {String} directory export directory
 */
export async function exportAllRawConfigEntities(directory) {
  let configEntities = [];
  try {
    configEntities = await getAllConfigEntities();
  } catch (getAllConfigEntitiesError) {
    printMessage(getAllConfigEntitiesError, 'error');
    printMessage(
      `Error getting config entities: ${getAllConfigEntitiesError}`,
      'error'
    );
  }
  if ('configurations' in configEntities) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
    createProgressIndicator(
      undefined,
      'Exporting config objects...',
      'indeterminate'
    );
    const entityPromises = [];
    configEntities['configurations'].forEach((x) => {
      entityPromises.push(
        getConfigEntity(x._id).catch((getConfigEntityError) => {
          if (
            !(
              getConfigEntityError.response?.status === 403 &&
              getConfigEntityError.response?.data?.message ===
                'This operation is not available in ForgeRock Identity Cloud.'
            ) &&
            // https://bugster.forgerock.org/jira/browse/OPENIDM-18270
            !(
              getConfigEntityError.response?.status === 404 &&
              getConfigEntityError.response?.data?.message ===
                'No configuration exists for id org.apache.felix.fileinstall/openidm'
            )
          ) {
            printMessage(getConfigEntityError.response?.data, 'error');
            printMessage(
              `Error getting config entity ${x._id}: ${getConfigEntityError}`,
              'error'
            );
          }
        })
      );
    });
    Promise.all(entityPromises).then((result) => {
      result.forEach((item) => {
        if (item != null) {
          fse.outputFile(
            `${directory}/${item._id}.json`,
            JSON.stringify(item, null, 2),
            // eslint-disable-next-line consistent-return
            (err) => {
              if (err) {
                return printMessage(
                  `ERROR - can't save config ${item._id} to file - ${err}`,
                  'error'
                );
              }
            }
          );
        }
      });
      stopProgressIndicator('Exported config objects.', 'success');
    });
  }
}

/**
 * Export all IDM configuration objects
 * @param {String} directory export directory
 * @param {String} entitiesFile JSON file that specifies the config entities to export/import
 * @param {String} envFile File that defines environment specific variables for replacement during configuration export/import
 */
export async function exportAllConfigEntities(
  directory,
  entitiesFile,
  envFile
) {
  let entriesToExport = [];
  // read list of entities to export
  fs.readFile(entitiesFile, 'utf8', async (err, data) => {
    if (err) throw err;
    const entriesData = JSON.parse(data);
    entriesToExport = entriesData.idm;
    // console.log(`entriesToExport ${entriesToExport}`);

    // read list of configs to parameterize for environment specific values
    const envParams = propertiesReader(envFile);

    let configEntities = [];
    try {
      configEntities = await getAllConfigEntities();
    } catch (getAllConfigEntitiesError) {
      printMessage(getAllConfigEntitiesError, 'error');
      printMessage(
        `Error getting config entities: ${getAllConfigEntitiesError}`,
        'error'
      );
    }
    if ('configurations' in configEntities) {
      // create export directory if not exist
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }
      createProgressIndicator(
        undefined,
        'Exporting config objects...',
        'indeterminate'
      );
      const entityPromises = [];
      configEntities['configurations'].forEach((x) => {
        if (entriesToExport.includes(x._id)) {
          entityPromises.push(getConfigEntity(x._id));
        }
      });
      Promise.all(entityPromises).then((result) => {
        result.forEach((item) => {
          if (item != null) {
            let configEntityString = JSON.stringify(item, null, 2);
            envParams.each((key, value) => {
              configEntityString = replaceall(
                value,
                `\${${key}}`,
                configEntityString
              );
            });
            fse.outputFile(
              `${directory}/${item._id}.json`,
              configEntityString,
              // eslint-disable-next-line consistent-return
              (error) => {
                if (err) {
                  return printMessage(
                    `ERROR - can't save config ${item._id} to file - ${error}`,
                    'error'
                  );
                }
              }
            );
          }
        });
        stopProgressIndicator(null, 'success');
      });
    }
  });
}

/**
 * Import an IDM configuration object.
 * @param entityId the configuration object to import
 * @param file optional file to import
 */
export async function importConfigEntity(
  entityId: string,
  file?: string,
  validate?: boolean
) {
  if (!file) {
    file = getTypedFilename(entityId, 'idm');
  }

  const entityData = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

  const jsObject = JSON.parse(entityData);
  const isValid = validateScriptHooks(jsObject);
  if (validate && !isValid) {
    printMessage('Invalid IDM configuration object', 'error');
    return;
  }

  try {
    await putConfigEntity(entityId, entityData);
  } catch (putConfigEntityError) {
    printMessage(putConfigEntityError, 'error');
    printMessage(`Error: ${putConfigEntityError}`, 'error');
  }
}

/**
 * Import all IDM configuration objects from separate JSON files in a directory specified by <directory>
 * @param baseDirectory export directory
 * @param validate validate script hooks
 */
export async function importAllRawConfigEntities(
  baseDirectory: string,
  validate?: boolean
) {
  if (!fs.existsSync(baseDirectory)) {
    return;
  }
  const files = await readFiles(baseDirectory);
  const jsonFiles = files
    .filter(({ path }) => path.toLowerCase().endsWith('.json'))
    .map(({ path, content }) => ({
      // Remove .json extension
      entityId: path.substring(0, path.length - 5),
      content,
      path,
    }));

  let everyScriptValid = true;
  for (const file of jsonFiles) {
    const jsObject = JSON.parse(file.content);
    const isScriptValid = validateScriptHooks(jsObject);
    if (!isScriptValid) {
      printMessage(`Invalid script hook in ${file.path}`, 'error');
      everyScriptValid = false;
    }
  }

  if (validate && !everyScriptValid) {
    return;
  }

  createProgressIndicator(
    undefined,
    'Importing config objects...',
    'indeterminate'
  );

  const entityPromises = jsonFiles.map((file) => {
    return putConfigEntity(file.entityId, file.content);
  });

  await Promise.allSettled(entityPromises).then((results) => {
    const errors = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (errors.length > 0) {
      printMessage(
        `Failed to import ${errors.length} config objects:`,
        'error'
      );
      errors.forEach((error) => {
        printMessage(`- ${error.reason}`, 'error');
      });
      stopProgressIndicator(
        `Failed to import ${errors.length} config objects`,
        'error'
      );
      return;
    }

    stopProgressIndicator(
      `Imported ${results.length} config objects`,
      'success'
    );
  });
}

/**
 * Import all IDM configuration objects
 * @param baseDirectory import directory
 * @param entitiesFile JSON file that specifies the config entities to export/import
 * @param envFile File that defines environment specific variables for replacement during configuration export/import
 * @param validate validate script hooks
 */
export async function importAllConfigEntities(
  baseDirectory: string,
  entitiesFile: string,
  envFile: string,
  validate?: boolean
) {
  if (!fs.existsSync(baseDirectory)) {
    return;
  }
  const entriesToImport = JSON.parse(fs.readFileSync(entitiesFile, 'utf8')).idm;

  const envReader = propertiesReader(envFile);

  const files = await readFiles(baseDirectory);
  const jsonFiles = files
    .filter(({ path }) => path.toLowerCase().endsWith('.json'))
    .map(({ content, path }) => ({
      // Remove .json extension
      entityId: path.substring(0, path.length - 5),
      content,
      path,
    }));

  let everyScriptValid = true;
  for (const file of jsonFiles) {
    const jsObject = JSON.parse(file.content);
    const isScriptValid = validateScriptHooks(jsObject);
    if (!isScriptValid) {
      printMessage(`Invalid script hook in ${file.path}`, 'error');
      everyScriptValid = false;
    }
  }

  if (validate && !everyScriptValid) {
    return;
  }

  createProgressIndicator(
    undefined,
    'Importing config objects...',
    'indeterminate'
  );

  const entityPromises = jsonFiles
    .filter(({ entityId }) => {
      return entriesToImport.includes(entityId);
    })
    .map(({ entityId, content }) => {
      const unsubstituted = unSubstituteEnvParams(content, envReader);
      return putConfigEntity(entityId, unsubstituted);
    });

  await Promise.allSettled(entityPromises).then((results) => {
    const errors = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (errors.length > 0) {
      printMessage(
        `Failed to import ${errors.length} config objects:`,
        'error'
      );
      errors.forEach((error) => {
        printMessage(`- ${error.reason}`, 'error');
      });
      stopProgressIndicator(
        `Failed to import ${errors.length} config objects`,
        'error'
      );
      return;
    }

    stopProgressIndicator(
      `Imported ${results.length} config objects`,
      'success'
    );
  });
}

/**
 * Count number of managed objects of a given type
 * @param {String} type managed object type, e.g. alpha_user
 */
export async function countManagedObjects(type) {
  let count = 0;
  let result = {
    result: [],
    resultCount: 0,
    pagedResultsCookie: null,
    totalPagedResultsPolicy: 'NONE',
    totalPagedResults: -1,
    remainingPagedResults: -1,
  };
  try {
    do {
      result = await queryAllManagedObjectsByType(
        type,
        [],
        result.pagedResultsCookie
      );
      count += result.resultCount;
    } while (result.pagedResultsCookie);
    printMessage(`${type}: ${count}`);
  } catch (error) {
    printMessage(error.response.data, 'error');
    printMessage(`Error querying managed objects by type: ${error}`, 'error');
  }
}
