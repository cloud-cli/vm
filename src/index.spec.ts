jest.mock('@cloud-cli/exec', () => {
  return { exec: jest.fn() }
});

import vm from './index';
import * as exec from '@cloud-cli/exec';

describe('volume manager', () => {
  it('runs', () => {
    expect(vm).not.toBeUndefined()
  });

  it('should list the available volumes', async () => {
    expect(await vm.list()).toEqual([]);
    expect(exec.exec).toHaveBeenCalled();
  });
})