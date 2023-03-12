const execMocks = {
  exec: jest.fn(),
};

jest.mock('@cloud-cli/exec', () => {
  return execMocks;
});

import vm from './index';
import * as exec from '@cloud-cli/exec';

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

    it('should throw error if volume name is invalid', async () => {
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

      await expect(vm.add({ name: 'test' })).resolves.toEqual('');

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

  describe('delete', () => {
    it('should add a volume', async () => {
      const execOutput = { ok: true, stdout: '' };
      execMocks.exec = jest.fn().mockResolvedValue(execOutput);

      await expect(vm.remove({ name: 'test' })).resolves.toEqual('');

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
