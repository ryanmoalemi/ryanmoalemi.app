# Article editor drafts

Cloud agents open a pull request so Ryan can review the draft at <https://ryanmoalemi.app/editor/> before it is published. The editor is a private static page. It is marked `noindex` and `/editor/` is disallowed in `robots.txt`. It is not listed in the sitemap.

## Repositories

The inbox reads open pull requests labeled `review` on:

- `ryanmoalemi/fullcourtbuckets`
- `ryanmoalemi/sandiegoadubuilder.com`
- `ryanmoalemi/ryanmoalemi.com`
- `ryanmoalemi/ryanmoalemi.app`
- `ryanmoalemi/ryanmoalemi.github.io`

## Pull request convention

1. Open a pull request against the repository's default branch.
2. Add the label `review`. Create that label in the repository if it does not exist yet.
3. Add one JSON file at `review/<slug>.json`. Use a short slug. The file name is not shown to readers.
4. Put the article HTML, its CSS, and its images on the same branch. Paths in the HTML must resolve on that branch.
5. Leave the pull request open. Ryan's editor lists those pull requests, newest first.

One pull request should carry one `review/<slug>.json` file. If a pull request has several, the inbox shows one card per file.

When Ryan sends a draft back, the editor posts his note as a pull request comment and adds the label `changes-requested`. Leave the `review` label in place so the draft stays in the inbox.

When Ryan approves, the editor saves any edits, squash-merges the pull request, and shows the live URL.

## Review JSON

Path: `review/<slug>.json`

The file is strict JSON. No comments and no trailing commas.

```json
{
  "site": "ryanmoalemi.app",
  "title": "Article title",
  "meta_description": "One or two sentences for the meta description.",
  "summary": "Two or three plain sentences that say what the article is about.",
  "uniqueness": {
    "summary": "The chart and the card notes are ours. A reader cannot get the same breakdown from a box score. The page says where each number came from.",
    "points": [
      "Our own chart of Reese's rebounding by quarter",
      "Ryan's first-hand card collection data"
    ]
  },
  "url_path": "/notes/article-title/",
  "files": ["notes/article-title/index.html"],
  "hero_image": "notes/article-title/hero.jpg",
  "unique": [
    "Our own chart of Reese's rebounding by quarter",
    "Ryan's first-hand card collection data"
  ],
  "unverified": [],
  "scorecard": {
    "overall": 8,
    "max": 10,
    "stars": 4,
    "grade": "Ready",
    "categories": [
      { "name": "Accuracy", "score": 9, "max": 10, "reason": "The numbers match the source." },
      { "name": "Information gain", "score": 6, "max": 10, "reason": "The chart is not on other sites." },
      { "name": "Effort and replication cost", "score": 7, "max": 10, "reason": "The table took original logging." },
      { "name": "Originality", "score": 7, "max": 10, "reason": "The angle is ours." },
      { "name": "Experience and expertise", "score": 8, "max": 10, "reason": "Written from watching the games." },
      { "name": "Main content and layout", "score": 8, "max": 10, "reason": "The page leads with the chart." },
      { "name": "Transparency", "score": 8, "max": 10, "reason": "Sources are named." },
      { "name": "Writing craft", "score": 8, "max": 10, "reason": "Sentences are specific." },
      { "name": "People-first purpose", "score": 8, "max": 10, "reason": "A reader can use the chart." },
      { "name": "Human voice", "score": 7, "max": 10, "reason": "It sounds like Ryan." }
    ],
    "info_gain": "A first-hand chart other pages do not have.",
    "ai_flags": ["The old opening used filler. It was rewritten from the game notes."]
  }
}
```

Every score is a whole number from 0 to 10. There are 10 categories, in this order: Accuracy, Information gain, Effort and replication cost, Originality, Experience and expertise, Main content and layout, Transparency, Writing craft, People-first purpose, and Human voice. Human voice is the written-by-AI check.

| Field | Meaning |
| --- | --- |
| `site` | Hostname, such as `ryanmoalemi.com`. A full `https://` URL is also accepted. |
| `title` | Article title. Ryan edits this on the page heading. |
| `meta_description` | Meta description. Ryan edits it at the top of the preview. |
| `summary` | Two or three plain sentences about the article. Shown in the same dashboard as the scores, stars, information-gain box, and human-voice flags. |
| `uniqueness` | Optional longer note. `summary` is two or three plain sentences. `points` is a list of short bullets. The inbox shows the first sentence of `uniqueness.summary` under the title. The dashboard boxes use `unique` and `scorecard.info_gain`. |
| `url_path` | Path on the live site. Start it with `/`. |
| `files` | Repo paths of the article HTML documents. The editor opens the file that matches `url_path`, otherwise the first HTML file. |
| `hero_image` | Repo path or absolute URL of the hero image. Also include that image in the HTML. |
| `unique` | Two to four plain bullets on what makes this unique and hard to copy, such as our own data, original analysis, real photos, or first-hand reporting. Shown under the stars. Use `[]` when there is nothing unique yet. An empty list shows a red "Nothing unique yet" warning. |
| `unverified` | Array of claims that are not checked. Use `[]` when every claim is checked. |
| `scorecard.overall` | Whole number from 0 to 10. Shown as `Overall 8/10`. |
| `scorecard.max` | Scale for the overall score. Use `10`. If it is omitted, the editor uses 10. |
| `scorecard.stars` | Optional. The editor draws stars from `overall / 2`. A score of 8 is 4 stars. A score of 9 is 4.5 stars. Half stars appear only in the icons. The number stays a whole number. |
| `scorecard.grade` | `Ready`, `Needs work`, or `Rework`. The editor computes this from the scores below. |
| `scorecard.categories` | Ten items, each scored 0 to 10. Each has `name`, `score`, `max` (`10`), and `reason`. The panel shows `N/10` and the reason. |
| `scorecard.info_gain` | One line on what this draft adds. Shown in the information-gain box under the stars, after the `unique` bullets. |
| `scorecard.ai_flags` | Lines that read as AI-written, and how they were fixed. Use `[]` when none remain. Shown in the Human voice box beside the information-gain box. |

### Score badge

The inbox and the top of the review screen show `Overall N/10`, stars (`overall / 2`, half stars only in the icons), and one badge.

| Badge | Color | When |
| --- | --- | --- |
| Ready | Green | Overall is 8 or higher, Accuracy is 9 or higher, Information gain is 6 or higher, and Human voice is 7 or higher |
| Needs work | Amber | Overall is 6 or 7, or overall is 8 or higher but a Ready gate is missed |
| Rework | Red | Overall is under 6 |

If `overall` is missing, the badge is Needs work.

Each category shows `N/10` and its one-line reason. The numbers are whole. The star icons use an accessible name such as `4 out of 5 stars`.

### Review screen

The review screen is one page. GitHub Pages hosts it, and the GitHub API is the only place drafts and edits are stored. On a wide window the dashboard sits beside the editable article. On a phone the dashboard stacks above the article.

The article opens as a word processor, like a document, using the site's own CSS. Ryan does not see HTML unless he opens Advanced. He can click in the article and type. The toolbar has Bold, Italic, Underline, Heading 2, Heading 3, bullets, numbered lists, link, undo, redo, and clear formatting. Bold, italic, underline, and undo also work with Ctrl or Cmd plus B, I, U, and Z. New links open in a new tab unless he turns that off.

A side panel has plain text boxes labeled Title, Search description, and Image description for each photo. Title updates the page heading. Search description is the meta description. Image description is the photo's alt text.

Show my edits highlights insertions and deletions against the original draft. Select text and choose Add note to leave a comment. Those notes are included when he sends the draft back.

Edits are saved in this browser every few seconds. The page says Saved. Reloading restores them. Save edits, Approve & publish, and Send back still commit to the pull request branch when the text, title, or search description changed.

The dashboard shows `Overall N/10` and the stars, then two boxes side by side: "Information gain: what makes this unique and hard to copy" (`unique` bullets and the `info_gain` line) and "Human voice" (`scorecard.ai_flags`). If `unique` is empty, the information-gain box shows a red "Nothing unique yet" warning. Under those boxes it shows `summary`, two or three plain sentences, then each category as `N/10` with its reason.

The inbox shows the same `Overall N/10`, stars, and grade, plus the first sentence of `uniqueness.summary` under the title when that field is present.

## Article HTML

Write a full HTML document.

- Link the site's CSS with root-relative or relative `link rel="stylesheet"` tags. The files must exist on the pull request branch. The editor loads that CSS through `api.github.com` and applies it in the preview, so the draft looks like the live page.
- Put the hero image in the document. `hero_image` is the repo path (or absolute URL) the editor uses to show the photo.
- Put the readable copy in headings, paragraphs, list items, quotes, table cells, and figcaptions inside `article` or `main`.
- The article body is editable, including the layout wrappers around the copy. Copy that lives only outside that body is not editable.
- Do not depend on scripts for the reading view. Scripts stay in the file when Ryan saves, but the preview does not run them and they are not editable.
- Keep the visible title in an `h1`. Ryan's Title field updates that heading, the document `<title>` (a site suffix after the old title is kept), `og:title` when present, and `title` in the review JSON.
- Keep `<meta name="description">` in the document. Ryan's Search description field updates that tag, `og:description` when present, and `meta_description` in the review JSON.
- Keep figures, captions, tables, links, classes, and JSON-LD. The editor writes the article body back with the same tags and classes. Anything outside the article body is left as it was.

## What the editor writes

Ryan signs in with a GitHub fine-grained personal access token. It is stored in `localStorage` in his browser and is sent only to `https://api.github.com`.

Repository access: only the five repositories above.

Repository permissions:

- Contents: Read and write
- Pull requests: Read and write

Actions:

| Button | Effect |
| --- | --- |
| Save edits | One commit on the pull request branch. The message is exactly `Ryan edits`. The commit updates the article HTML and, when the title or meta description changed, the review JSON. Before the commit, the editor checks that photos, photo credits, tables, links, and the hidden search summary are still present unless Ryan deleted them. If that check fails, nothing is committed. |
| Approve & publish | Asks for confirmation, saves edits, squash-merges the pull request, then shows the live URL (`https://` + `site` + `url_path`). The same check runs before the save. A failed check does not merge. |
| Send back | Saves unsent edits, posts Ryan's note and any comments as a pull request comment, and adds the label `changes-requested`. |

The live URL can take a minute to update after a merge while GitHub Pages builds.
