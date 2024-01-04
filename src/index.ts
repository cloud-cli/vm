import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { exec } from '@cloud-cli/exec';

const nameRe = /^[a-z][a-z0-9-]+$/;
const isValidName = (name) => nameRe.test(name);
const invalidNameError = new Error('Invalid name');

interface NameOption {
  name: string;
}

interface NameAndPathOption {
  name: string;
  path?: string;
}

async function list() {
  const output = await exec('docker', ['volume', 'ls', '--format={{.Name}}']);

  if (!output.ok) {
    throw new Error('Unable to list volumes');
  }

  return output.stdout.trim().split('\n');
}

async function getVolumeMountpoint(name): Promise<string> {
  const output = await exec('docker', ['volume', 'inspect', name]);
  const volumes = JSON.parse(output.stdout);

  if (!volumes.length) {
    throw new Error('Volume not found');
  }

  return volumes[0].Mountpoint;
}

async function ls(options: NameAndPathOption) {
  const { name, path = '' } = options;
  const root = await getVolumeMountpoint(name);
  const files = await exec('ls', ['-1', join(root, path)]);

  return files.stdout.trim().split('\n').filter(Boolean);
}

async function fixPermissions(options: NameOption) {
  const { name } = options;
  const root = await getVolumeMountpoint(name);
  const result = await exec('chmod', ['-R', 'a+w', root]);

  return result.ok;
}

async function rm(options: NameAndPathOption) {
  const { name, path } = options;

  if (!path) {
    throw new Error('Path not specified');
  }

  const root = await getVolumeMountpoint(name);
  const result = await exec('rm', ['-r', join(root, path)]);

  return result.ok;
}

async function cat(options: NameAndPathOption) {
  const { name, path } = options;

  if (!path) {
    throw new Error('Path not specified');
  }

  const root = await getVolumeMountpoint(name);
  return await readFile(join(root, path), 'utf8');
}

async function show(options: NameOption) {
  if (!isValidName(options.name)) {
    throw invalidNameError;
  }

  const output = await exec('docker', ['volume', 'inspect', options.name]);
  const list = JSON.parse(output.stdout);

  if (!list.length) {
    throw new Error('Volume not found');
  }

  const { Name, Labels, CreatedAt } = list[0];

  return {
    name: Name,
    createdAt: CreatedAt,
    labels: Labels,
  };
}

async function add(options: NameOption) {
  if (!isValidName(options.name)) {
    throw invalidNameError;
  }

  const output = await exec('docker', ['volume', 'create', options.name]);

  if (output.ok) {
    return true;
  }

  throw new Error('Unable to create volume');
}

async function remove(options: NameOption) {
  if (!isValidName(options.name)) {
    throw invalidNameError;
  }

  const output = await exec('docker', ['volume', 'rm', options.name]);

  if (output.ok) {
    return true;
  }

  throw new Error('Unable to remove volume');
}

async function prune() {
  await exec('docker', ['volume', 'prune']);
  return '';
}

export default { add, remove, list, show, prune, ls, rm, cat, fixPermissions };
