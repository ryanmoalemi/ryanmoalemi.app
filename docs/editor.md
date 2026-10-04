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
| `summary` | Two or three plain sentences about the article. Shown in the scorecard. |
| `uniqueness` | What makes the draft hard to copy. `summary` is two or three plain sentences. `points` is a list of short bullets. The review screen shows this in a highlighted box under the star rating and above the article. The inbox shows the first sentence of `uniqueness.summary` under the title. |
| `url_path` | Path on the live site. Start it with `/`. |
| `files` | Repo paths of the article HTML documents. The editor opens the file that matches `url_path`, otherwise the first HTML file. |
| `hero_image` | Repo path or absolute URL of the hero image. Also include that image in the HTML. |
| `unique` | Two to four short bullets on what makes the draft hard to copy. Use `[]` only when there is nothing unique yet. |
| `unverified` | Array of claims that are not checked. Use `[]` when every claim is checked. |
| `scorecard.overall` | Whole number from 0 to 10. Shown as `Overall 8/10`. |
| `scorecard.max` | Scale for the overall score. Use `10`. |
| `scorecard.stars` | Optional. The editor draws stars from `overall / 2`. A score of 8 is 4 stars. A score of 9 is 4.5 stars. Half stars appear only in the icons. |
| `scorecard.grade` | `Ready`, `Needs work`, or `Rework`. The editor also computes this from the scores below. |
| `scorecard.categories` | Each item has `name`, `score` (0 to 10), `max` (`10`), and `reason` (one line). |
| `scorecard.info_gain` | One line on what this draft adds. Shown inside the information-gain box. |
| `scorecard.ai_flags` | Lines that read as AI-written, and how they were fixed. Use `[]` when none remain. |

### Score badge

The inbox and the review screen show stars, `Overall N/10`, and one badge:

| Badge | Color | When |
| --- | --- | --- |
| Ready | Green | Overall is 8 or higher, Accuracy is 9 or higher, Information gain is 6 or higher, and Human voice is 7 or higher |
| Needs work | Amber | Overall is 6 or 7, or overall is 8 or higher but a Ready gate is missed |
| Rework | Red | Overall is under 6 |

If `overall` is missing and the draft has `scorecard.total`, stars are `total / max * 5`, rounded to the nearest half star. When `max` is omitted, it is 45. A total of 41 is shown as `4.5 stars` and `41/45`, with the grade badge beside the stars. The badge uses `grade` when it says Ready, Needs work, Rework, or a letter (A is Ready, B is Needs work, C, D, or F is Rework). With no grade, 80% or more of `max` is Ready, 60% up to 80% is Needs work, and below 60% is Rework. If neither `overall` nor `total` is present, the badge is Needs work.

Each category shows `N/10` (or `score/max`), stars (`score / max * 5`, nearest half star), and its one-line reason. The star icons use an accessible name such as `4.5 out of 5 stars`.

### Review screen

The star rating sits at the top of the review screen. Directly under it, and above the article, a highlighted box titled "What makes this hard to copy" shows `uniqueness.summary` and `uniqueness.points`. The category scorecard stays on the same screen. On a wide window it sits beside the article. On a phone it follows the article. The panel also shows "Human voice" (`ai_flags`) and the article `summary`.

## Article HTML

Write a full HTML document.

- Link the site's CSS with root-relative or relative `link rel="stylesheet"` tags. The files must exist on the pull request branch. The editor loads that CSS through `api.github.com` and applies it in the preview, so the draft looks like the live page.
- Put the hero image in the document. `hero_image` is the repo path (or absolute URL) the editor uses to show the photo.
- Put the readable copy in headings, paragraphs, list items, quotes, table cells, and figcaptions inside `article` or `main`.
- Do not put the only copy of a sentence inside a layout `div`. Layout elements are not editable.
- Do not depend on scripts for the reading view. Scripts stay in the file when Ryan saves, but the preview does not run them and they are not editable.
- Keep the visible title in an `h1`. Ryan's edit updates that heading, the document `<title>` (a site suffix after the old title is kept), `og:title` when present, and `title` in the review JSON.
- Keep `<meta name="description">` in the document. Ryan's edit updates that tag, `og:description` when present, and `meta_description` in the review JSON.

## What the editor writes

Ryan signs in with a GitHub fine-grained personal access token. It is stored in `localStorage` in his browser and is sent only to `https://api.github.com`.

Repository access: only the five repositories above.

Repository permissions:

- Contents: Read and write
- Pull requests: Read and write

Actions:

| Button | Effect |
| --- | --- |
| Save edits | One commit on the pull request branch. The message is exactly `Ryan edits`. The commit updates the article HTML and, when the title or meta description changed, the review JSON. |
| Approve & publish | Asks for confirmation, saves edits, squash-merges the pull request, then shows the live URL (`https://` + `site` + `url_path`). |
| Send back | Saves unsent edits, posts Ryan's note as a pull request comment, and adds the label `changes-requested`. |

The live URL can take a minute to update after a merge while GitHub Pages builds.
