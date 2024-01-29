const core = require('@actions/core')
const github = require('@actions/github')
const { Client } = require('@notionhq/client')
const {
  notionInsertRow,
  constructNotionPayload
} = require('./functions/notion')
const { delay } = require('./functions/helpers')

async function run() {
  try {
    const projectName = core.getInput('project-name')
    const repoUrl = core.getInput('repo-url')
    const myToken = core.getInput('github-token')
    const NOTION_API_KEY = core.getInput('notion-api-key')
    const ISSUES_DB_ID = core.getInput('issues-db-id')
    const REPO_LIST_DB_ID = core.getInput('repo-list-db-id')

    const parts = repoUrl.split('/')
    const owner = parts[3]
    const repo = parts[4]
    const octokit = github.getOctokit(myToken)
    const notion = new Client({ auth: NOTION_API_KEY })

    try {
      const res = await octokit.rest.repos.listLanguages({ owner, repo })
      const total = Object.values(res.data).reduce((acc, val) => acc + val, 0)
      const filteredData = Object.fromEntries(
        Object.entries(res.data).filter(([key, value]) => value >= 0.1 * total)
      )
      const multi_select = Object.keys(filteredData).map(lang => {
        return {
          name: lang
        }
      })
      const response = await notion.pages.create({
        parent: {
          type: 'database_id',
          database_id: REPO_LIST_DB_ID
        },
        properties: {
          Repo: {
            type: 'title',
            title: [
              {
                type: 'text',
                text: {
                  content: repoUrl
                }
              }
            ]
          },
          'Project Name': {
            type: 'rich_text',
            rich_text: [
              {
                type: 'text',
                text: {
                  content: projectName
                }
              }
            ]
          },
          Language: { type: 'multi_select', multi_select }
          // "Import Status": {
          //   type: "select",
          //   select: {
          //     name: "Imported",
          //     color: "green",
          //   },
          // },
        }
      })

      const newRepoPageId = response.id
      const issues = await octokit.paginate(
        octokit.rest.issues.listForRepo,
        {
          owner,
          repo,
          per_page: 100
        },
        r =>
          r.data.reduce((filtered, issue) => {
            if (issue.user.type === 'User' && issue.draft === undefined) {
              // exclude pull requests as well
              filtered.push({ data: issue })
            }
            return filtered
          }, [])
      )

      const notion_objs = issues.map(r =>
        constructNotionPayload({ [repoUrl]: newRepoPageId }, r)
      )

      console.log(`Importing ${issues.length} from GitHub into Notion...\n`)

      let successful_import_count = 0
      const failed_import_links = new Set()
      for (const row of notion_objs) {
        const success = await notionInsertRow(notion, row, ISSUES_DB_ID)
        if (success) {
          successful_import_count++
        } else {
          failed_import_links.add(row['Issue Link'].url)
        }
        await delay(500)
      }

      // retry importing links
      for (const row of failed_import_links) {
        const success = await notionInsertRow(notion, row, ISSUES_DB_ID)
        if (success) {
          successful_import_count++
          failed_import_links.delete(row['Issue Link'].url)
        }
        await delay(500)
      }

      console.log(
        `Successfully imported ${successful_import_count} of ${issues.length}.`
      )

      if (failed_import_links.size) {
        core.setOutput('failed_import_links', Array.from(failed_import_links))
      }
    } catch (error) {
      console.log(error)
      core.setFailed(error.message)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
