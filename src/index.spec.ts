const execMocks = {
  exec: jest.fn(),
};

const fsMocks = {
  readFile: jest.fn(),
};

jest.mock('@cloud-cli/exec', () => execMocks);
jest.mock('node:fs/promises', () => fsMocks);

import vm from './index';
import * as exec from '@cloud-cli/exec';
import * as fs from 'node:fs/promises';

const inspectOutput = `[{
"CreatedAt": "2023-03-10T10:15:10Z",
"Driver": "local",
"Labels": {
  "origin": "test/container",
  "version": "534524"
},
"Mountpoint": "/var/lib/docker/volumes/test/_data",
"Name": "test",
"Options": {},
"Scope": "local"
}]`;

describe('volume manager', () => {
  describe('list', () => {
    it('should list the available volumes', async () => {
      const execOutput = {
        ok: true,
        stdout: `test\ntest2\n`,
      };

      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.list()).resolves.toEqual(['test', 'test2']);
      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'ls', '--format={{.Name}}']);
    });

    it('should reject in case of error', async () => {
      const output = { ok: false };
      execMocks.exec = jest.fn().mockResolvedValue(output);

      await expect(vm.list()).rejects.toThrowError('Unable to list volumes');
    });
  });

  describe('fixPermissions', () => {
    it('should fix write permissions on volume folder', async () => {
      const outputs = [inspectOutput, ''];
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.fixPermissions({ name: 'test' })).resolves.toEqual(true);
      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(exec.exec).toHaveBeenCalledWith('chmod', ['-R', 'a+w', '/var/lib/docker/volumes/test/_data']);
    });
  });

  describe('ls', () => {
    it('should list files of a volume and path', async () => {
      const outputs = [inspectOutput, 'dir', inspectOutput, 'a.txt\nb.txt'];
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.ls({ name: 'test' })).resolves.toEqual(['dir']);
      await expect(vm.ls({ name: 'test', path: 'dir' })).resolves.toEqual(['a.txt', 'b.txt']);

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(exec.exec).toHaveBeenCalledWith('ls', ['-1', '/var/lib/docker/volumes/test/_data']);
      expect(exec.exec).toHaveBeenCalledWith('ls', ['-1', '/var/lib/docker/volumes/test/_data/dir']);
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.ls({ name: 'notfound' })).rejects.toThrowError('Volume not found');
    });
  });

  describe('rm', () => {
    it('should remove files of a volume by path', async () => {
      const outputs = [inspectOutput, ''];
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.rm({ name: 'test', path: 'file.txt' })).resolves.toEqual(true);

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(exec.exec).toHaveBeenCalledWith('rm', ['-r', '/var/lib/docker/volumes/test/_data/file.txt']);
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.rm({ name: 'notfound', path: 'file.txt' })).rejects.toThrowError('Volume not found');
    });

    it('should throw an error if path is invalid', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      await expect(vm.rm({ name: 'nopath' })).rejects.toThrowError('Path not specified');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });
  });

  describe('cat', () => {
    it('should read the content of a file in a volume by path', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      fsMocks.readFile = jest.fn().mockImplementation(() => 'test file');

      await expect(vm.cat({ name: 'test', path: 'file.txt' })).resolves.toEqual('test file');

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(fs.readFile).toHaveBeenCalledWith('/var/lib/docker/volumes/test/_data/file.txt', 'utf8');
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.cat({ name: 'notfound', path: 'file.txt' })).rejects.toThrowError('Volume not found');
    });

    it('should throw an error if path is invalid', async () => {
      execMocks.exec = jest.fn().mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      await expect(vm.cat({ name: 'nopath' })).rejects.toThrowError('Path not specified');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should show details of a volume', async () => {
      const execOutput = { ok: true, stdout: inspectOutput };
      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.show({ name: 'test' })).resolves.toEqual({
        name: 'test',
        createdAt: '2023-03-10T10:15:10Z',
        labels: {
          origin: 'test/container',
          version: '534524',
        },
      });

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec = jest.fn();
      await expect(vm.show({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume does not exist', async () => {
      const output = { ok: true, stdout: '[]' };
      execMocks.exec = jest.fn().mockResolvedValue(output);

      await expect(vm.show({ name: 'invalid' })).rejects.toThrowError('Volume not found');
    });
  });

  describe('add', () => {
    it('should add a volume', async () => {
      const execOutput = { ok: true, stdout: 'test' };
      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.add({ name: 'test' })).resolves.toEqual(true);

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'create', 'test']);
    });

    it('should throw error if volume name is invalid', async () => {
      execMocks.exec = jest.fn();
      await expect(vm.add({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume creation fails', async () => {
      const output = { ok: false, stdout: '' };
      execMocks.exec = jest.fn().mockResolvedValue(output);

      await expect(vm.add({ name: 'failed' })).rejects.toThrowError('Unable to create volume');
    });
  });

  describe('remove', () => {
    it('should add a volume', async () => {
      const execOutput = { ok: true, stdout: '' };
      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.remove({ name: 'test' })).resolves.toEqual(true);

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'rm', 'test']);
    });

    it('should throw error if volume name is invalid', async () => {
      execMocks.exec = jest.fn();
      await expect(vm.remove({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume removal fails', async () => {
      const output = { ok: false, stdout: '' };
      execMocks.exec = jest.fn().mockResolvedValue(output);

      await expect(vm.remove({ name: 'failed' })).rejects.toThrowError('Unable to remove volume');
    });
  });

  describe('prune', () => {
    it('should remove ununsed volumes', async () => {
      const execOutput = { ok: true, stdout: '' };
      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.prune()).resolves.toEqual('');

      expect(exec.exec).toHaveBeenCalledWith('docker', ['volume', 'prune']);
    });
  });
});
