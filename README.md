# Issue Duplicator

With this GitHub Action, you can duplicate an issue with `/duplicate` issue comment. It creates a duplicated issue in the same repository with these copied properties:

- Title
- Body
- Assignees
- Labels
- Milestone
- GitHub projects (including their custom fields)

Note that the following properties are _not_ copied from the original issue:

- Author
- Comments
- State (open or closed)
- Locked or not

## Usage

Add `.github/workflows/issue-duplicator.yml` to your repository:

```yml
name: Issue Duplicator

on:
  issue_comment:
    types: [created, edited]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: mashabow/issue-duplicator-action@v1
        with:
          github-token: ${{ secrets.REPO_PROJECT_PAT }}
```

### Input

- `github-token` **(required)**: a [personal access
  token](https://github.com/settings/tokens/new) with `repo` and `project` scopes.

## Development

### Manual testing

For manual testing against your development branch, you can use this workflow in another repository:

```yml
name: Issue Duplicator (dev)

on:
  issue_comment:
    types: [created, edited]

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          repository: mashabow/issue-duplicator-action
          ref: your-development-branch
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
      - uses: ./
        with:
          github-token: ${{ secrets.REPO_PROJECT_PAT }}
```

### Publish

To publish a new version of this action, create a release on GitHub. Then the following stuff are automatically done with [JasonEtco/build-and-tag-action](https://github.com/JasonEtco/build-and-tag-action).

1. Build this action.
2. Commit `actions.yml` and the built file.
3. Push the commit with version tags.
