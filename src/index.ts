import { exec } from '@cloud-cli/exec'

function list() {
  return exec('docker', ['volume'])
}

export default { list }