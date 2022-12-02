import util from 'util';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import storage from '../storage/SessionStorage';
import { PagedResult } from './ApiTypes';

const scriptURLTemplate = '%s/json%s/scripts/%s';
const scriptListURLTemplate = '%s/json%s/scripts?_queryFilter=true';
const scriptQueryURLTemplate =
  '%s/json%s/scripts?_queryFilter=name+eq+%%22%s%%22';
const apiVersion = 'protocol=2.0,resource=1.0';
const getApiConfig = () => {
  return {
    path: `/json${getCurrentRealmPath()}/scripts`,
    apiVersion,
  };
};

export interface Script {
  _id: string;
  name: string;
  description: string;

  /**
   * A Base64 encoded string of the script
   */
  script: string;
  default: boolean;
  language: string;
  context: string;
  createdBy: string;
  creationDate: number;
  lastModifiedBy: string;
  lastModifiedDate: number;
}

/**
 * Get all scripts
 * @returns {Promise} a promise that resolves to an object containing an array of script objects
 */
export async function getScripts(): Promise<PagedResult<Script>> {
  const urlString = util.format(
    scriptListURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  const { data } = await generateAmApi(getApiConfig()).get<PagedResult<Script>>(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get script by name
 * @param {String} scriptName script name
 * @returns {Promise} a promise that resolves to an object containing a script object
 */
export async function getScriptByName(
  scriptName: string
): Promise<PagedResult<Script>> {
  const urlString = util.format(
    scriptQueryURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    scriptName
  );
  const { data } = await generateAmApi(getApiConfig()).get<PagedResult<Script>>(
    urlString,
    {
      withCredentials: true,
    }
  );
  return data;
}

/**
 * Get script by id
 * @param {String} scriptId script uuid/name
 * @returns {Promise} a promise that resolves to an object containing a script object
 */
export async function getScript(scriptId) {
  const urlString = util.format(
    scriptURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    scriptId
  );
  const { data } = await generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
  return data;
}

/**
 * Put script
 * @param {string} scriptId script uuid
 * @param {Object} scriptData script object
 * @returns {Promise} a promise that resolves to an object containing a script object
 */
export async function putScript(scriptId, scriptData) {
  const urlString = util.format(
    scriptURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath(),
    scriptId
  );
  const { data } = await generateAmApi(getApiConfig()).put(
    urlString,
    scriptData,
    {
      withCredentials: true,
    }
  );
  return data;
}
