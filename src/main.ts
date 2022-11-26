import * as core from '@actions/core'
import * as github from '@actions/github'
import {ProjectV2FieldValue, getSdk} from './graphql'
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
    const octokit = github.getOctokit(token)

    // https://docs.github.com/en/rest/issues/issues#create-an-issue
    const {data: createdIssue} = await octokit.rest.issues.create({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      title: event.issue.title,
      body: event.issue.body ?? undefined,
      milestone: event.issue.milestone?.number,
      labels: event.issue.labels,
      assignees: event.issue.assignees.map(({login}) => login)
    })

    core.info(`Issue created: ${createdIssue.url}`)
    core.debug('createdIssue:')
    core.debug(JSON.stringify(createdIssue, null, 2))

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
        ...project,
        fields: (fieldValues.nodes ?? [])
          .map(node => {
            if (!(node && 'field' in node)) return null
            return {
              id: node.field.id,
              name: node.field.name,
              value: ((): ProjectV2FieldValue | undefined => {
                switch (node.__typename) {
                  case 'ProjectV2ItemFieldDateValue':
                    return {date: node.date}
                  case 'ProjectV2ItemFieldIterationValue':
                    return {iterationId: node.iterationId}
                  case 'ProjectV2ItemFieldNumberValue':
                    return {number: node.number}
                  case 'ProjectV2ItemFieldSingleSelectValue':
                    return {singleSelectOptionId: node.optionId}
                  case 'ProjectV2ItemFieldTextValue':
                    if (node.field.dataType === 'TEXT') return {text: node.text}
                }
              })()
            }
          })
          .filter(
            (
              field
            ): field is {
              id: string
              name: string
              value: ProjectV2FieldValue
            } => Boolean(field?.value)
          )
      }))

    for (const project of projects) {
      const res = await graphqlClient.addIssueToProject({
        input: {projectId: project.id, contentId: createdIssue.node_id}
      })
      core.info(`Added issue to project: ${project.url}`)
      const itemId = res.addProjectV2ItemById?.item?.id
      if (!itemId) throw new Error('Missing itemId.')
      core.debug(`itemId: ${itemId}`)

      for (const field of project.fields) {
        await graphqlClient.setProjectFieldValue({
          input: {
            projectId: project.id,
            itemId,
            fieldId: field.id,
            value: field.value
          }
        })
        core.info(`- Set field value: ${field.name}`)
      }
    }
    core.info('Successfully duplicated.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
