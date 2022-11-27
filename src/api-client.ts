import * as github from '@actions/github'
import type {Issue, Repository} from '@octokit/webhooks-types'
import {ProjectV2FieldValue, Sdk, getSdk} from './graphql'

type Field = {
  readonly id: string
  readonly name: string
  readonly value: ProjectV2FieldValue
}

type Project = {
  readonly id: string
  readonly url: string
  readonly fields: readonly Field[]
}

export class ApiClient {
  private readonly rest: ReturnType<typeof github.getOctokit>['rest']
  private readonly graphql: Sdk

  constructor(token: string) {
    const octokit = github.getOctokit(token)
    this.rest = octokit.rest
    this.graphql = getSdk(octokit.graphql)
  }

  async duplicateIssue(
    originalIssue: Issue,
    repository: Repository
  ): Promise<{
    readonly id: string
    readonly url: string
  }> {
    // https://docs.github.com/en/rest/issues/issues#create-an-issue
    const {data: createdIssue} = await this.rest.issues.create({
      owner: repository.owner.login,
      repo: repository.name,
      title: originalIssue.title,
      body: originalIssue.body ?? undefined,
      milestone: originalIssue.milestone?.number,
      labels: originalIssue.labels,
      assignees: originalIssue.assignees.map(({login}) => login)
    })
    return {id: createdIssue.node_id, url: createdIssue.html_url}
  }

  async getProjectFieldValues(issueId: string): Promise<readonly Project[]> {
    const data = await this.graphql.projectFieldValues({issueId})
    if (!(data.node && 'projectItems' in data.node)) {
      throw new Error('Missing `projectItems` for the original issue.')
    }

    const items = data.node.projectItems.nodes ?? []
    return items
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
          .filter((field): field is Field => Boolean(field?.value))
      }))
  }

  async addIssueToProject(issueId: string, projectId: string): Promise<string> {
    const data = await this.graphql.addIssueToProject({
      input: {projectId, contentId: issueId}
    })
    const itemId = data.addProjectV2ItemById?.item?.id
    if (!itemId) throw new Error('Missing itemId.')
    return itemId
  }

  async setProjectFieldValue(
    projectId: string,
    itemId: string,
    field: Field
  ): Promise<void> {
    await this.graphql.setProjectFieldValue({
      input: {
        projectId,
        itemId,
        fieldId: field.id,
        value: field.value
      }
    })
  }

  async updateIssueComment(commentId: string, body: string): Promise<void> {
    await this.graphql.updateIssueComment({input: {id: commentId, body}})
  }
}
