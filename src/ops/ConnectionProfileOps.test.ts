import fs from 'fs';
import { homedir } from 'os';
import { ConnectionProfile, state } from '../index';
import {
  FRODO_CONNECTION_PROFILES_PATH_KEY,
  FRODO_MASTER_KEY_PATH_KEY,
  FRODO_MASTER_KEY_KEY,
} from '../storage/StaticStorage';

describe('ConnectionProfileOps', () => {
  test('saveConnectionProfile() 1: Create connection profiles in location from state field', async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections1.json`;

    state.setHost(host);
    state.setUsername(user);
    state.setPassword(password);
    state.setConnectionProfilesPath(connectionProfilePath);
    await ConnectionProfile.saveConnectionProfile(host);
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, 'utf8')
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });

  test(`saveConnectionProfile() 2: Create connection profiles in location from env ${FRODO_MASTER_KEY_PATH_KEY}`, async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections2.json`;
    // set the hard-coded master key
    process.env[FRODO_CONNECTION_PROFILES_PATH_KEY] = connectionProfilePath;

    state.setHost(host);
    state.setUsername(user);
    state.setPassword(password);
    state.setConnectionProfilesPath('');
    await ConnectionProfile.saveConnectionProfile(host);
    expect(ConnectionProfile.getConnectionProfilesPath()).toEqual(
      connectionProfilePath
    );
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, 'utf8')
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });

  test(`saveConnectionProfile() 3: Use Master Key from env ${FRODO_MASTER_KEY_KEY}`, async () => {
    const host = 'https://openam-tenant-name.forgeblocks.com/am';
    const user = 'frodo.baggins@shire.me';
    const password = 'G@nd@lfTheW153';
    const connectionProfilePath = `${homedir()}/connections3.json`;
    const masterKey = 'bxnQlhcU5VfyDs+BBPhRhK09yHaNtdIIk85HUMKBnqg=';
    // set the hard-coded master key
    process.env[FRODO_MASTER_KEY_KEY] = masterKey;

    state.setHost(host);
    state.setUsername(user);
    state.setPassword(password);
    state.setConnectionProfilesPath(connectionProfilePath);
    await ConnectionProfile.saveConnectionProfile(host);
    expect(fs.existsSync(connectionProfilePath)).toBeTruthy();
    const connections = JSON.parse(
      fs.readFileSync(connectionProfilePath, 'utf8')
    );
    expect(connections).toBeTruthy();
    expect(connections[host]).toBeTruthy();
    expect(connections[host].username).toEqual(user);
    expect(connections[host].encodedPassword).toBeTruthy();
  });
});
