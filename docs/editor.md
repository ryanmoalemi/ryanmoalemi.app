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
  "url_path": "/notes/article-title/",
  "files": ["notes/article-title/index.html"],
  "hero_image": "notes/article-title/hero.jpg",
  "scorecard": {
    "total": 86,
    "grade": "A",
    "categories": [
      {
        "name": "Clarity",
        "score": 9,
        "max": 10,
        "reason": "The opening states the point."
      }
    ],
    "info_gain": "What this draft adds that a generic page would not.",
    "unverified": ["Any claim that is not checked"]
  }
}
```

| Field | Meaning |
| --- | --- |
| `site` | Hostname, such as `ryanmoalemi.com`. A full `https://` URL is also accepted. |
| `title` | Article title. Ryan edits this on the page heading. |
| `meta_description` | Meta description. Ryan edits it at the top of the preview. |
| `url_path` | Path on the live site. Start it with `/`. |
| `files` | Repo paths of the article HTML documents. The editor opens the file that matches `url_path`, otherwise the first HTML file. |
| `hero_image` | Repo path or absolute URL of the hero image. Also include that image in the HTML. |
| `scorecard.total` | Number shown on the card, usually from 0 to 100. |
| `scorecard.grade` | Letter grade. See the badge rules below. |
| `scorecard.categories` | Each item has `name`, `score`, `max`, and `reason`. |
| `scorecard.info_gain` | A string or number describing what the draft adds. |
| `scorecard.unverified` | Array of strings. Use `[]` when every claim is checked. |

### Score badge

The inbox and the side panel use one badge:

| Badge | Color | When |
| --- | --- | --- |
| Ready | Green | Grade starts with A, or there is no letter grade and `total` is 80 or higher |
| Needs work | Amber | Grade starts with B, or there is no letter grade and `total` is 60 to 79 |
| Rework | Red | Grade starts with C, D, or F, or there is no letter grade and `total` is below 60 |

The letter grade wins when it is present. If `grade` is empty and `total` is missing, the editor uses the average of `categories` (score divided by max) with the same 80 and 60 cutoffs. If nothing is scored, the badge is Needs work.

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
