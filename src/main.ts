import * as core from '@actions/core'
import * as github from '@actions/github'
// eslint-disable-next-line import/no-unresolved
import {IssueCommentEvent} from '@octokit/webhooks-types'

async function run(): Promise<void> {
  try {
    if (github.context.eventName !== 'issue_comment') {
      throw new Error('This action must be used with `issue_comment` event.')
    }

    const event = github.context.payload as IssueCommentEvent
    if (event.action !== 'created') {
      throw new Error('This action must be used with `created` activity type.')
    }

    core.info(JSON.stringify(github.context, null, 2))
    core.debug('debug!')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
