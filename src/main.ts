import * as core from '@actions/core'
import * as github from '@actions/github'
import {ApiClient} from './api-client'
// eslint-disable-next-line import/no-unresolved
import {IssueCommentEvent} from '@octokit/webhooks-types'

async function run(): Promise<void> {
  try {
    core.debug('github.context:')
    core.debug(JSON.stringify(github.context, null, 2))

    if (github.context.eventName !== 'issue_comment') {
      throw new Error('This action must be used with `issue_comment` event.')
    }

    const event = github.context.payload as IssueCommentEvent
    if (event.action !== 'created') {
      throw new Error('This action must be used with `created` activity type.')
    }

    if (event.comment.body.trim() !== '/duplicate') return

    const token = core.getInput('github-token')
    const apiClient = new ApiClient(token)

    const createdIssue = await apiClient.duplicateIssue(
      event.issue,
      event.repository
    )
    core.info(`Issue created: ${createdIssue.url}`)
    core.debug('createdIssue:')
    core.debug(JSON.stringify(createdIssue, null, 2))

    const projects = await apiClient.getProjectFieldValues(event.issue.node_id)
    for (const project of projects) {
      const itemId = await apiClient.addIssueToProject(
        createdIssue.node_id,
        project.id
      )
      core.info(`Added issue to project: ${project.url}`)
      core.debug(`itemId: ${itemId}`)

      for (const field of project.fields) {
        await apiClient.setProjectFieldValue(project.id, itemId, field)
        core.info(`- Set field value: ${field.name}`)
      }
    }
    core.info('Successfully duplicated.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
