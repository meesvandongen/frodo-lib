import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { state } from '../index';
import * as globalConfig from '../storage/StaticStorage';
import { createJwkRsa, createJwks, getJwkRsaPublic } from './JoseOps';
import * as ServiceAccount from './ServiceAccountOps';
import { mockCreateManagedObject } from '../test/mocks/ForgeRockApiMockEngine';
import { isEqualJson } from './utils/OpsUtils';

const mock = new MockAdapter(axios);

const outputHandler = (message: string | object) => {
  console.log(message);
};

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');
state.setDeploymentType(globalConfig.CLOUD_DEPLOYMENT_TYPE_KEY);
state.setDebug(true);
state.setDebugHandler(outputHandler);
state.setPrintHandler(outputHandler);
state.setCurlirize(true);
state.setCurlirizeHandler(outputHandler);

describe('SvcacctOps - createSvcacct()', () => {
  test('createSvcacct() 0: Method is implemented', async () => {
    expect(ServiceAccount.createServiceAccount).toBeDefined();
  });

  test('createSvcacct() 1: Create service account', async () => {
    let moId: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let moData: any | null = null;
    const name = 'sa';
    const description = 'service account';
    const accountStatus = 'Active';
    const scopes = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
    const jwk = await createJwkRsa();
    const publicJwk = await getJwkRsaPublic(jwk);
    const jwks = await createJwks(publicJwk);
    mockCreateManagedObject(mock, (mockManagedObjId, mockManagedObj) => {
      moId = mockManagedObjId;
      moData = mockManagedObj;
    });
    const payload = await ServiceAccount.createServiceAccount(
      name,
      description,
      accountStatus,
      scopes,
      jwks
    );
    expect(isEqualJson(payload, moData)).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(payload._id).toBe(moId);
    expect(payload.name).toBe(name);
    expect(payload.description).toBe(description);
    expect(payload.scopes).toStrictEqual(scopes);
  });
});
