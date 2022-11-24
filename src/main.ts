import * as core from '@actions/core'
import * as github from '@actions/github'
// eslint-disable-next-line import/no-unresolved
import {IssueCommentEvent} from '@octokit/webhooks-types'
import {getSdk} from './graphql'

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
    const octokit = github.getOctokit(token)

    // https://docs.github.com/en/rest/issues/issues#create-an-issue
    const res = await octokit.rest.issues.create({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      title: event.issue.title,
      body: event.issue.body ?? undefined,
      milestone: event.issue.milestone?.number,
      labels: event.issue.labels,
      assignees: event.issue.assignees.map(({login}) => login)
    })

    core.info('res:')
    core.info(JSON.stringify(res, null, 2))

    const graphqlClient = getSdk(octokit.graphql)
    const data = await graphqlClient.projectFieldValues({
      issueNodeId: event.issue.node_id
    })
    if (!(data.node && 'projectItems' in data.node)) {
      throw new Error('Missing `projectItems` for the original issue.')
    }

    const items = data.node.projectItems.nodes ?? []
    const projects = items
      .filter((item): item is NonNullable<typeof items[number]> =>
        Boolean(item)
      )
      .map(({project, fieldValues}) => ({
        projectId: project.id,
        fields: fieldValues.nodes
          ?.map(node => {
            if (!(node && 'field' in node)) return null
            const value = (() => {
              if ('date' in node) return node.date
              if ('iterationId' in node) return node.iterationId
              if ('number' in node) return node.number
              if ('optionId' in node) return node.optionId
              if ('text' in node && node.field.dataType === 'TEXT')
                return node.text
            })()
            if (value === null || value === undefined) return null
            return {fieldId: node.field.id, value}
          })
          .filter((field): field is {fieldId: string; value: string | number} =>
            Boolean(field)
          )
      }))

    core.info('projects:')
    core.info(JSON.stringify(projects, null, 2))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
