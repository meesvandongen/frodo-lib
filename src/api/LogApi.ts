import util from 'util';
import { generateLogApi, generateLogKeysApi } from './BaseApi';
import { getTenantURL } from './utils/ApiUtils';
import * as state from '../shared/State';

const logsTailURLTemplate = '%s/monitoring/logs/tail?source=%s';
const logsFetchURLTemplate =
  '%s/monitoring/logs?source=%s&beginTime=%s&endTime=%s';
const logsSourcesURLTemplate = '%s/monitoring/logs/sources';
const logsCreateAPIKeyAndSecretURLTemplate = '%s/keys?_action=create';
const logsGetAPIKeysURLTemplate = '%s/keys';

export async function tail(source, cookie) {
  let urlString = util.format(
    logsTailURLTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(source)
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  return generateLogApi().get(urlString);
}

export async function getAPIKeys() {
  const urlString = util.format(
    logsGetAPIKeysURLTemplate,
    getTenantURL(state.getHost())
  );
  return generateLogKeysApi().get(urlString);
}

export async function getSources() {
  const urlString = util.format(
    logsSourcesURLTemplate,
    getTenantURL(state.getHost())
  );
  return generateLogApi().get(urlString);
}

export async function createAPIKeyAndSecret(keyName) {
  const urlString = util.format(
    logsCreateAPIKeyAndSecretURLTemplate,
    getTenantURL(state.getHost())
  );
  return generateLogKeysApi().post(urlString, { name: keyName });
}

export async function fetch(source, startTs, endTs, cookie) {
  let urlString = util.format(
    logsFetchURLTemplate,
    getTenantURL(state.getHost()),
    encodeURIComponent(source),
    startTs,
    endTs
  );
  if (cookie) {
    urlString += `&_pagedResultsCookie=${encodeURIComponent(cookie)}`;
  }
  return generateLogApi({ timeout: 60000 }).get(urlString);
}
