import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    core.info(JSON.stringify(github.context, null, 2))
    core.debug('debug!')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
