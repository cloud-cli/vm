import { join } from "node:path";
import { exec } from "@cloud-cli/exec";

const nameRe = /^[a-z][a-z0-9-]+$/;
const isValidName = (name) => nameRe.test(name);
const invalidNameError = new Error("Invalid name");

interface NameOption {
  name: string;
}

interface NameAndPathOption {
  name: string;
  path?: string;
}

async function list() {
  const output = await exec("docker", ["volume", "ls", "--format={{.Name}}"]);

  if (!output.ok) {
    throw new Error("Unable to list volumes");
  }

  return output.stdout.trim().split("\n");
}

async function ls(options: NameAndPathOption) {
  const { name, path = "" } = options;
  const output = await exec("docker", ["volume", "inspect", name]);
  const volumes = JSON.parse(output.stdout);

  if (!volumes.length) {
    throw new Error("Volume not found");
  }

  const root = volumes[0].Mountpoint;
  const files = await exec("ls", ["-1", join(root, path)]);

  return files.stdout.trim().split("\n");
}

async function show(options: NameOption) {
  if (!isValidName(options.name)) {
    throw invalidNameError;
  }

  const output = await exec("docker", ["volume", "inspect", options.name]);
  const list = JSON.parse(output.stdout);

  if (!list.length) {
    throw new Error("Volume not found");
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

  const output = await exec("docker", ["volume", "create", options.name]);

  if (output.ok) {
    return true;
  }

  throw new Error("Unable to create volume");
}

async function remove(options: NameOption) {
  if (!isValidName(options.name)) {
    throw invalidNameError;
  }

  const output = await exec("docker", ["volume", "rm", options.name]);

  if (output.ok) {
    return true;
  }

  throw new Error("Unable to remove volume");
}

async function prune() {
  await exec("docker", ["volume", "prune"]);
  return "";
}

export default { add, remove, list, show, prune, ls };
