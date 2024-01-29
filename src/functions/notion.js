const { truncateText } = require('./helpers')

async function notionUpdateRow(notion, page_id, row) {
  console.log(`Updating notion page: ${page_id}`)
  try {
    const response = await notion.pages.update({
      page_id,
      properties: row
    })
    console.log(`Update complete of page: ${page_id} complete.`)
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

async function notionInsertRow(
  notion,
  row,
  database_id // = process.env.ISSUES_DB_ID
) {
  console.log(`Inserting notion page for link: ${row['Issue Link'].url}`)
  try {
    const response = await notion.pages.create({
      parent: {
        type: 'database_id',
        database_id
      },
      properties: row
    })
    console.log(`Insert complete for link:${row['Issue Link'].url}`)
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

// async function notionQueryTable(notion, query_object) {
//   try {
//     let response = await notion.databases.query(query_object);
//     return response;
//   } catch (err) {
//     console.log(err);
//     return {};
//   }
// }

// async function createRepoMap(notion, filter, filter_properties) {
//   let out = {};
//   try {
//     let response = await notionQueryTable(notion, {
//       database_id: process.env.REPO_LIST_DB_ID,
//       filter_properties: ["title"],
//     });

//     response.results.forEach((issue) => {
//       out[issue.properties.Repo.title[0].text.content] = issue.id;
//     });

//     while (response.has_more) {
//       response = await notionQueryTable(notion, {
//         database_id: process.env.REPO_LIST_DB_ID,
//         filter_properties: ["title"],
//         start_cursor: response.next_cursor,
//       });

//       response.results.forEach((issue) => {
//         out[issue.properties.Repo.title[0].text.content] = issue.id;
//       });
//     }
//   } catch (err) {
//     console.log("There was a problem creating the repository map...");
//     console.log(err);
//   }
//   return out;
// }

function constructNotionPayload(repoMap, apiResponse) {
  const repo_name =
    apiResponse.data.repository_url.split('/')[
      apiResponse.data.repository_url.split('/').length - 1
    ]
  const org_name =
    apiResponse.data.repository_url.split('/')[
      apiResponse.data.repository_url.split('/').length - 2
    ]

  const full_github_repo_link = `https://github.com/${org_name}/${repo_name}`
  const notion_obj = {
    Etag: {
      type: 'rich_text',
      rich_text: [
        {
          type: 'text',
          text: {
            content: apiResponse.headers?.etag ? apiResponse.headers.etag : ''
          }
        }
      ]
    },
    'Issue Title': {
      type: 'title',
      title: [
        {
          type: 'text',
          text: {
            content: apiResponse.data.title ? apiResponse.data.title : ''
          }
        }
      ]
    },
    'Github Repo': {
      type: 'relation',
      relation: [
        {
          id: repoMap[full_github_repo_link]
        }
      ]
    },
    'Issue Link': { type: 'url', url: apiResponse.data.html_url },
    'Opened By': { type: 'url', url: apiResponse.data.user.html_url },
    'Issue Labels': {
      type: 'multi_select',
      multi_select: apiResponse.data.labels.map(label => {
        return {
          name: label.name,
          color: 'gray'
        }
      })
    },
    'Issue State': {
      type: 'select',
      select: {
        name: apiResponse.data.state,
        color: apiResponse.data.state === 'open' ? 'green' : 'purple'
      }
    },
    Assignee: {
      type: 'url',
      url: apiResponse.data['assignee']
        ? apiResponse.data.assignee.html_url
        : null
    },
    'Opened Date': {
      type: 'date',
      date: { start: apiResponse.data.created_at }
    },
    'Issue Body': {
      type: 'rich_text',
      rich_text: [
        {
          type: 'text',
          text: {
            content: apiResponse.data.body
              ? truncateText(apiResponse.data.body, 1999)
              : ''
          }
        }
      ]
    }
  }
  return notion_obj
}

module.exports = {
  constructNotionPayload,
  // createRepoMap,
  notionInsertRow,
  notionUpdateRow
}
