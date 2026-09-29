import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getStorage, help } from '@cloud-cli/cli';
import vm from './index';

const execMocks = vi.hoisted(() => ({
  exec: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('get-port', () => ({ default: vi.fn().mockReturnValue(1234) }));
vi.mock('@cloud-cli/exec', () => ({ exec: execMocks.exec }));
vi.mock('@cloud-cli/cli', async (importOriginal) => {
  const mod: any = await importOriginal();
  return {
    ...mod,
    help: mod.help,
  };
});

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

describe('help', () => {
  it('should have a [help] Symbol export that is a function', () => {
    expect(vm[help]).toBeDefined();
    expect(typeof vm[help]).toBe('function');
  });

  it('should return a string help text', () => {
    const helpText = vm[help]();
    expect(typeof helpText).toBe('string');
    expect(helpText).toContain('Docker');
    expect(helpText).toContain('vm add');
    expect(helpText).toContain('vm rm');
    expect(helpText).toContain('vm ls');
    expect(helpText).toContain('vm cat');
    expect(helpText).toContain('vm show');
    expect(helpText).toContain('vm fixpermissions');
    expect(helpText).toContain('vm prune');
    expect(helpText).toContain('vm ls');
  });

  it('should not expose "help" as a normal command key', () => {
    expect(vm.help).toBeUndefined();
  });
});

describe('volume manager', () => {
  beforeEach(() => {
    execMocks.exec.mockReset();
    execMocks.readFile.mockReset();
  });

  describe('list', () => {
    it('should list the available volumes', async () => {
      const execOutput = {
        ok: true,
        stdout: `test\ntest2\n`,
      };

      execMocks.exec.mockResolvedValue(execOutput);

      await expect(vm.list()).resolves.toEqual(['test', 'test2']);
      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'ls', '--format={{.Name}}']);
    });

    it('should reject in case of error', async () => {
      const output = { ok: false };
      execMocks.exec.mockResolvedValue(output);

      await expect(vm.list()).rejects.toThrowError('Unable to list volumes');
    });
  });

  describe('fixPermissions', () => {
    it('should fix write permissions on volume folder', async () => {
      const outputs = [inspectOutput, ''];
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.fixPermissions({ name: 'test' })).resolves.toEqual(true);
      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(execMocks.exec).toHaveBeenCalledWith('chmod', ['-R', 'a+w', '/var/lib/docker/volumes/test/_data']);
    });
  });

  describe('ls', () => {
    it('should list files of a volume and path', async () => {
      const outputs = [inspectOutput, 'dir', inspectOutput, 'a.txt\nb.txt'];
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.ls({ name: 'test' })).resolves.toEqual(['dir']);
      await expect(vm.ls({ name: 'test', path: 'dir' })).resolves.toEqual(['a.txt', 'b.txt']);

      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(execMocks.exec).toHaveBeenCalledWith('ls', ['-1', '/var/lib/docker/volumes/test/_data']);
      expect(execMocks.exec).toHaveBeenCalledWith('ls', ['-1', '/var/lib/docker/volumes/test/_data/dir']);
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.ls({ name: 'notfound' })).rejects.toThrowError('Volume not found');
    });
  });

  describe('rm', () => {
    it('should remove files of a volume by path', async () => {
      const outputs = [inspectOutput, ''];
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: outputs.shift() }));

      await expect(vm.rm({ name: 'test', path: 'file.txt' })).resolves.toEqual(true);

      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(execMocks.exec).toHaveBeenCalledWith('rm', ['-r', '/var/lib/docker/volumes/test/_data/file.txt']);
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.rm({ name: 'notfound', path: 'file.txt' })).rejects.toThrowError('Volume not found');
    });

    it('should throw an error if path is invalid', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      await expect(vm.rm({ name: 'nopath' })).rejects.toThrowError('Path not specified');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });
  });

  describe('cat', () => {
    it('should read the content of a file in a volume by path', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      execMocks.readFile.mockImplementation(() => 'test file');

      await expect(vm.cat({ name: 'test', path: 'file.txt' })).resolves.toEqual('test file');

      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
      expect(execMocks.readFile).toHaveBeenCalledWith('/var/lib/docker/volumes/test/_data/file.txt', 'utf8');
    });

    it('should throw an error if volume name is invalid', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: '[]' }));
      await expect(vm.cat({ name: 'notfound', path: 'file.txt' })).rejects.toThrowError('Volume not found');
    });

    it('should throw an error if path is invalid', async () => {
      execMocks.exec.mockImplementation(() => ({ ok: true, stdout: inspectOutput }));
      await expect(vm.cat({ name: 'nopath' })).rejects.toThrowError('Path not specified');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('should show details of a volume', async () => {
      const execOutput = { ok: true, stdout: inspectOutput };
      execMocks.exec.mockResolvedValue(execOutput);

      await expect(vm.show({ name: 'test' })).resolves.toEqual({
        name: 'test',
        createdAt: '2023-03-10T10:15:10Z',
        labels: {
          origin: 'test/container',
          version: '534524',
        },
      });

      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'inspect', 'test']);
    });

    it('should throw an error if volume name is invalid', async () => {
      await expect(vm.show({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume does not exist', async () => {
      const output = { ok: true, stdout: '[]' };
      execMocks.exec.mockResolvedValue(output);

      await expect(vm.show({ name: 'invalid' })).rejects.toThrowError('Volume not found');
    });
  });

  describe('add', () => {
    it('should add a volume', async () => {
      const execOutput = { ok: true, stdout: 'test' };
      execMocks.exec.mockResolvedValue(execOutput);

      await expect(vm.add({ name: 'test' })).resolves.toEqual(true);

      expect(execMocks.exec).toHaveBeenCalledWith('docker', ['volume', 'create', 'test']);
    });

    it('should throw error if volume name is invalid', async () => {
      await expect(vm.add({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume creation fails', async () => {
      const output = { ok: false, stdout: '' };
      execMocks.exec.mockResolvedValue(output);

      await expect(vm.add({ name: 'failed' })).rejects.toThrowError('Unable to create volume');
    });
  });

  describe('remove', () => {
    it('should add a volume', async () => {
      const execOutput = { ok: true, stdout: '' };
      execMocks.exec.mockResolvedValue(execOutput);

      await expect(vm.remove({ name: 'test' })).resolves.toEqual(true);
    });

    it('should throw error if volume name is invalid', async () => {
      await expect(vm.remove({ name: 'In$%valid' })).rejects.toThrowError('Invalid name');
      expect(execMocks.exec).not.toHaveBeenCalled();
    });

    it('should throw error if volume removal fails', async () => {
      const output = { ok: false, stdout: '' };
      execMocks.exec.mockResolvedValue(output);

      await expect(vm.remove({ name: 'failed' })).rejects.toThrowError('Unable to remove volume');
    });
  });

  describe('prune', () => {
    it('should remove ununsed volumes', async () => {
      const execOutput = { ok: true, stdout: '' };
      execMocks.exec.mockResolvedValue(execOutput);

      await expect(vm.prune()).resolves.toEqual('');
    });
  });
});
