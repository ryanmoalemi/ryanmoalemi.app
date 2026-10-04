var assert = require("assert");
var fs = require("fs");
var path = require("path");
var lib = require("./lib.js");

var now = Date.parse("2026-10-04T12:00:00Z");

assert.deepStrictEqual(lib.REPOS, [
  "ryanmoalemi/fullcourtbuckets",
  "ryanmoalemi/sandiegoadubuilder.com",
  "ryanmoalemi/ryanmoalemi.com",
  "ryanmoalemi/ryanmoalemi.app",
  "ryanmoalemi/ryanmoalemi.github.io"
]);

assert.strictEqual(lib.isGitHubApiUrl("https://api.github.com/repos/ryanmoalemi/ryanmoalemi.app"), true);
assert.strictEqual(lib.isGitHubApiUrl("https://api.github.com/repos/x?ref=1"), true);
assert.strictEqual(lib.isGitHubApiUrl("http://api.github.com/repos/x"), false);
assert.strictEqual(lib.isGitHubApiUrl("https://raw.githubusercontent.com/ryanmoalemi/ryanmoalemi.app/main/index.html"), false);
assert.strictEqual(lib.isGitHubApiUrl("https://github.com/ryanmoalemi/ryanmoalemi.app"), false);
assert.strictEqual(lib.isGitHubApiUrl("not a url"), false);

assert.strictEqual(lib.cleanToken("  Bearer github_pat_abc\n"), "github_pat_abc");
assert.strictEqual(lib.cleanToken("github_pat_abc def"), "github_pat_abcdef");

assert.strictEqual(lib.resolveRepoPath("drafts/morning-reset/index.html", "article.css"), "drafts/morning-reset/article.css");
assert.strictEqual(lib.resolveRepoPath("drafts/morning-reset/index.html", "/styles.css"), "styles.css");
assert.strictEqual(lib.resolveRepoPath("drafts/morning-reset/index.html", "../hero.svg"), "drafts/hero.svg");
assert.strictEqual(lib.resolveRepoPath("drafts/morning-reset/index.html", "hero.svg?v=2"), "drafts/morning-reset/hero.svg");
assert.strictEqual(lib.resolveRepoPath("a/b/c.html", "https://cdn.example/app.css"), "");
assert.strictEqual(lib.encodeRepoPath("review/my draft.json"), "review/my%20draft.json");

assert.strictEqual(lib.liveUrl("ryanmoalemi.app", "/drafts/morning-reset/"), "https://ryanmoalemi.app/drafts/morning-reset/");
assert.strictEqual(lib.liveUrl("https://ryanmoalemi.com/", "notes/a"), "https://ryanmoalemi.com/notes/a");
assert.strictEqual(lib.liveUrl("sandiegoadubuilder.com", ""), "https://sandiegoadubuilder.com/");

function card(overall, accuracy, info, voice) {
  return {
    overall: overall,
    max: 10,
    categories: [
      { name: "Accuracy", score: accuracy, max: 10 },
      { name: "Information gain", score: info, max: 10 },
      { name: "Human voice", score: voice, max: 10 }
    ]
  };
}
assert.deepStrictEqual(lib.badgeFor(card(8, 9, 6, 7)), { key: "ready", label: "Ready" });
assert.deepStrictEqual(lib.badgeFor(card(9, 10, 8, 9)), { key: "ready", label: "Ready" });
assert.deepStrictEqual(lib.badgeFor(card(8, 8, 6, 7)), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor(card(8, 9, 5, 7)), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor(card(8, 9, 6, 6)), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor(card(7, 10, 10, 10)), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor(card(6, 9, 6, 7)), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor(card(5, 10, 10, 10)), { key: "rework", label: "Rework" });
assert.deepStrictEqual(lib.badgeFor({}), { key: "needs-work", label: "Needs work" });
assert.strictEqual(lib.overallScore({ overall: 8.4 }), 8);
assert.strictEqual(lib.scoreMax({}), 10);
assert.strictEqual(lib.scoreMax({ max: 10 }), 10);
assert.strictEqual(lib.starCount(8, 10), 4);
assert.strictEqual(lib.starCount(9, 10), 4.5);
assert.strictEqual(lib.starCount(7, 10), 3.5);
assert.strictEqual(lib.starCount(10, 10), 5);
assert.strictEqual(lib.starCount(41, 45), 4.5);
assert.strictEqual(lib.starCount(45, 45), 5);
assert.strictEqual(lib.starCount(32, 45), 3.5);
assert.strictEqual(lib.starCount(0, 45), 0);
assert.deepStrictEqual(lib.pointsScore({ overall: 8, max: 10 }), { score: 8, max: 10, kind: "overall" });
assert.deepStrictEqual(lib.pointsScore({ overall: 8, total: 41, max: 10 }), { score: 8, max: 10, kind: "overall" });
assert.strictEqual(lib.pointsScore({ total: 41 }), null);
assert.strictEqual(lib.starPhrase(4.5), "4.5 stars");
assert.strictEqual(lib.starPhrase(4), "4 stars");
assert.strictEqual(lib.starPhrase(1), "1 star");
assert.strictEqual(lib.starLabel(4), "4 out of 5 stars");
assert.strictEqual(lib.starLabel(4.5), "4.5 out of 5 stars");
assert.deepStrictEqual(lib.badgeFor({ total: 45, max: 50, grade: "Ready" }), { key: "needs-work", label: "Needs work" });
assert.deepStrictEqual(lib.badgeFor({ overall: 5, max: 10, grade: "Ready", categories: [
  { name: "Accuracy", score: 10, max: 10 },
  { name: "Information gain", score: 10, max: 10 },
  { name: "Human voice", score: 10, max: 10 }
] }), { key: "rework", label: "Rework" });
assert.strictEqual(lib.firstSentence("A quieter morning. The rest stays back."), "A quieter morning.");
assert.deepStrictEqual(lib.uniquenessBlock({
  uniqueness: {
    summary: " The chart is ours. A box score does not have it. ",
    points: ["Our own chart of Reese's rebounding by quarter", "Ryan's first-hand card collection data"]
  }
}), {
  summary: "The chart is ours. A box score does not have it.",
  points: ["Our own chart of Reese's rebounding by quarter", "Ryan's first-hand card collection data"]
});
assert.strictEqual(lib.firstSentence(lib.uniquenessBlock({
  uniqueness: { summary: "The chart is ours. A box score does not have it." }
}).summary), "The chart is ours.");
assert.deepStrictEqual(lib.uniquePoints({ unique: ["Our chart", ""] }), ["Our chart"]);
assert.strictEqual(lib.articleSummary({ summary: " Two sentences. More. " }), "Two sentences. More.");
assert.deepStrictEqual(lib.aiFlags({ ai_flags: ["Filler rewritten."] }), ["Filler rewritten."]);
assert.deepStrictEqual(lib.unverifiedList({ unverified: ["A guess"] }), ["A guess"]);

assert.strictEqual(lib.ageLabel("2026-10-04T11:59:30Z", now), "just now");
assert.strictEqual(lib.ageLabel("2026-10-04T11:30:00Z", now), "30m ago");
assert.strictEqual(lib.ageLabel("2026-10-04T09:00:00Z", now), "3h ago");
assert.strictEqual(lib.ageLabel("2026-10-01T12:00:00Z", now), "3d ago");

var sorted = lib.sortDrafts([
  { title: "B", createdAt: "2026-10-01T00:00:00Z" },
  { title: "A", createdAt: "2026-10-03T00:00:00Z" },
  { title: "C", createdAt: "2026-10-03T00:00:00Z" }
]);
assert.deepStrictEqual(sorted.map(function (item) { return item.title; }), ["A", "C", "B"]);

assert.strictEqual(lib.hasReviewLabel([{ name: "Review" }, { name: "bug" }]), true);
assert.strictEqual(lib.hasReviewLabel([{ name: "changes-requested" }]), false);
assert.deepStrictEqual(lib.reviewJsonPaths([
  "review/morning-reset.json",
  "review/nested/nope.json",
  "notes/index.html",
  "REVIEW/Upper.json"
]), ["review/morning-reset.json", "REVIEW/Upper.json"]);

assert.strictEqual(
  lib.pickPrimaryFile(["notes/other.html", "drafts/morning-reset/index.html"], "/drafts/morning-reset/"),
  "drafts/morning-reset/index.html"
);
assert.strictEqual(lib.pickPrimaryFile(["a.html", "b.html"], "/missing/"), "a.html");

assert.strictEqual(
  lib.nextLink('<https://api.github.com/repos/a/b/pulls?page=2>; rel="next", <https://api.github.com/repos/a/b/pulls?page=3>; rel="last"'),
  "https://api.github.com/repos/a/b/pulls?page=2"
);
assert.strictEqual(lib.nextLink('<https://evil.example/next>; rel="next"'), "");
assert.strictEqual(lib.mimeFor("drafts/hero.svg"), "image/svg+xml");
assert.strictEqual(lib.mimeFor("styles.css"), "text/css");

var updated = lib.withReviewMeta(JSON.stringify({
  site: "ryanmoalemi.app",
  title: "Old",
  meta_description: "Old desc",
  url_path: "/x/",
  files: ["x.html"]
}), "New", "New desc");
var parsed = JSON.parse(updated);
assert.strictEqual(parsed.title, "New");
assert.strictEqual(parsed.meta_description, "New desc");
assert.strictEqual(parsed.site, "ryanmoalemi.app");
assert.strictEqual(updated.endsWith("\n"), true);

var editorSrc = fs.readFileSync(path.join(__dirname, "editor.js"), "utf8");
var libSrc = fs.readFileSync(path.join(__dirname, "lib.js"), "utf8");
var roundSrc = fs.readFileSync(path.join(__dirname, "roundtrip.js"), "utf8");
var wordSrc = fs.readFileSync(path.join(__dirname, "src", "word.js"), "utf8");
var htmlSrc = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
[editorSrc, libSrc, roundSrc, wordSrc, htmlSrc].forEach(function (src) {
  assert.strictEqual(src.indexOf("raw.githubusercontent.com"), -1);
  assert.strictEqual(/github_pat_[A-Za-z0-9]{20,}/.test(src), false);
  assert.strictEqual(/ghp_[A-Za-z0-9]{20,}/.test(src), false);
  assert.strictEqual(/ghs_[A-Za-z0-9]{20,}/.test(src), false);
  assert.strictEqual(src.indexOf("\u2014"), -1);
});
assert.ok(editorSrc.indexOf("Information gain: what makes this unique and hard to copy") > -1);
assert.ok(editorSrc.indexOf("Nothing unique yet") > -1);
assert.strictEqual(editorSrc.indexOf("var show ="), -1, "local show shadows function show()");
assert.ok(/function show\(/.test(editorSrc));
var signinSrc = editorSrc.slice(editorSrc.indexOf("function renderSignin"), editorSrc.indexOf("function renderInbox"));
assert.strictEqual(/\bvar\s+show\b/.test(signinSrc), false, "signin block shadows show()");
assert.ok(signinSrc.indexOf("var showBtn") > -1);
assert.ok((signinSrc.match(/\bshowBtn\b/g) || []).length >= 4);
var storedAt = signinSrc.indexOf("writeStoredToken(next)");
assert.ok(storedAt > signinSrc.indexOf("await assertToken()"));
assert.ok(signinSrc.indexOf("show()", storedAt) > storedAt);
assert.ok(signinSrc.indexOf("clearStoredToken()", storedAt) > storedAt);
var bootSrc = editorSrc.slice(editorSrc.indexOf("async function boot"));
assert.strictEqual(bootSrc.indexOf("Checking the saved token"), -1);
assert.ok(bootSrc.indexOf("show()") < bootSrc.indexOf("await assertToken()"));
assert.ok(bootSrc.indexOf("clearStoredToken()") > bootSrc.indexOf("await assertToken()"));
assert.ok(htmlSrc.indexOf('content="noindex"') > -1, "missing noindex");
assert.ok(htmlSrc.indexOf("connect-src https://api.github.com") > -1);
assert.strictEqual((editorSrc.match(/fetch\s*\(/g) || []).length, 2);
assert.ok(editorSrc.indexOf('credentials: "omit"') > editorSrc.indexOf("function pollLive"));

var robots = fs.readFileSync(path.join(__dirname, "..", "robots.txt"), "utf8");
assert.ok(robots.indexOf("Disallow: /editor/") > -1);
assert.ok(robots.indexOf("Disallow: /AGENTS.md") > -1);
assert.ok(robots.indexOf("Disallow: /README.md") > -1);
var sitemap = fs.readFileSync(path.join(__dirname, "..", "sitemap.xml"), "utf8");
assert.strictEqual(sitemap.indexOf("editor"), -1);
assert.ok(sitemap.indexOf("https://ryanmoalemi.app/privacy/") > -1);
assert.strictEqual(sitemap.indexOf("privacy.html"), -1);
var pagesConfig = fs.readFileSync(path.join(__dirname, "..", "_config.yml"), "utf8");
assert.ok(pagesConfig.indexOf('"*.md"') > -1);

assert.deepStrictEqual(lib.diffWords("alpha beta", "alpha beta"), [{ op: "equal", text: "alpha beta" }]);
assert.deepStrictEqual(lib.diffWords("alpha beta", "alpha gamma beta"), [
  { op: "equal", text: "alpha " },
  { op: "insert", text: "gamma " },
  { op: "equal", text: "beta" }
]);
assert.deepStrictEqual(lib.diffWords("alpha beta", "alpha"), [
  { op: "equal", text: "alpha" },
  { op: "delete", text: " beta" }
]);
assert.strictEqual(lib.formatSendBackNote("Fix the lede.", [
  { quote: "Hello world", note: "Say who this is." },
  { quote: "", note: "Check the date." }
]), "Fix the lede.\n\nNotes on the draft:\n- \"Hello world\": Say who this is.\n- Check the date.");
assert.strictEqual(lib.formatSendBackNote("", [{ quote: "Sale", note: "Add the date." }]), "Notes on the draft:\n- \"Sale\": Add the date.");
assert.strictEqual(lib.autosaveKey("ryanmoalemi/fullcourtbuckets", 78, "news/a/index.html"), "rm-editor-draft:ryanmoalemi/fullcourtbuckets:78:news/a/index.html");
assert.strictEqual(lib.isFineGrainedToken("github_pat_abc"), true);
assert.strictEqual(lib.isFineGrainedToken("ghp_abc"), false);
assert.strictEqual(lib.pendingKey("ryanmoalemi/fullcourtbuckets", 83, "review/buckets.json"), "rm-editor-pending:ryanmoalemi/fullcourtbuckets:83:review/buckets.json");
assert.strictEqual(lib.plainText("<p>Resource not accessible</p>"), "Resource not accessible");
assert.strictEqual(lib.plainText("<!DOCTYPE html><html><body>nope</body></html>"), "GitHub sent a page instead of an answer.");
assert.strictEqual(lib.plainText("Resource not accessible by personal access token"), "Resource not accessible by personal access token");
assert.strictEqual(lib.isAccessError(403, "Resource not accessible by personal access token"), true);
assert.strictEqual(lib.isAccessError(403, "API rate limit exceeded"), false);
assert.strictEqual(lib.probeAllows({ status: 403, message: "Resource not accessible by personal access token" }, "write"), false);
assert.strictEqual(lib.probeAllows({ status: 404, message: "Not Found" }, "write"), true);
assert.strictEqual(lib.probeAllows({ status: 422, message: "Invalid" }, "write"), true);
assert.strictEqual(lib.probeAllows({ status: 404, message: "Not Found" }, "repo"), false);
assert.strictEqual(lib.probeAllows({ status: 200, message: "" }, "read"), true);
assert.strictEqual(lib.probeAllows({ status: 0, message: "" }, "read"), null);
var allMissing = lib.REPOS.map(function (repo) {
  return { repo: repo, contentsRead: false, contentsWrite: false, pullsRead: false, pullsWrite: false };
});
assert.strictEqual(
  lib.permissionBanner(allMissing),
  "Missing Contents: Read and write, Pull requests: Read and write on fullcourtbuckets, sandiegoadubuilder.com, ryanmoalemi.com, ryanmoalemi.app, ryanmoalemi.github.io."
);
assert.strictEqual(lib.permissionBanner([
  { repo: "ryanmoalemi/fullcourtbuckets", contentsRead: true, contentsWrite: true, pullsRead: true, pullsWrite: false },
  { repo: "ryanmoalemi/ryanmoalemi.app", contentsRead: true, contentsWrite: true, pullsRead: true, pullsWrite: true }
]), "Missing Pull requests: Read and write on fullcourtbuckets.");
assert.strictEqual(lib.permissionBanner([{ repo: "ryanmoalemi/ryanmoalemi.app", contentsRead: true, contentsWrite: true, pullsRead: true, pullsWrite: true }]), "");
assert.deepStrictEqual(
  lib.permissionsFromFailure("https://api.github.com/repos/ryanmoalemi/fullcourtbuckets/pulls/83/reviews", 403, "Resource not accessible by personal access token", "pull_requests=write"),
  ["Pull requests: Read and write"]
);
assert.deepStrictEqual(
  lib.permissionsFromFailure("https://api.github.com/repos/ryanmoalemi/fullcourtbuckets/git/blobs", 403, "Resource not accessible by personal access token", ""),
  ["Contents: Read and write"]
);
assert.strictEqual(
  lib.writeFailureMessage({ permissions: ["Pull requests: Read and write"], repo: "ryanmoalemi/fullcourtbuckets", kept: "note", committed: false }),
  "The note is saved in this browser. GitHub did not receive it. The token is missing Pull requests: Read and write on fullcourtbuckets. Open token settings, set Pull requests to Read and write, then press Retry."
);
var pending = lib.parsePending(JSON.stringify({
  action: "send-back",
  repo: "ryanmoalemi/fullcourtbuckets",
  number: 83,
  jsonPath: "review/buckets.json",
  note: "Tighten the lede and name the source.",
  title: "Buckets",
  slug: "buckets",
  description: "A search line.",
  body: "<p>Keep the lede.</p>",
  steps: { commit: "skip", comment: "pending", label: "pending", merge: "skip" }
}));
assert.strictEqual(pending.note, "Tighten the lede and name the source.");
assert.strictEqual(pending.body, "<p>Keep the lede.</p>");
assert.strictEqual(lib.pendingDone(pending), false);
pending.steps.comment = "done";
pending.steps.label = "done";
assert.strictEqual(lib.pendingDone(pending), true);
assert.strictEqual(lib.formatPacificTime(new Date("2026-10-04T21:38:00Z")), "2:38 PM PT");
assert.strictEqual(lib.livePageReady("<title>Full court buckets</title><h1>Full court buckets</h1>", "Full court buckets", 200), true);
assert.strictEqual(lib.livePageReady("<h1>Old title</h1>", "Full court buckets", 200), false);
assert.strictEqual(lib.livePageReady("<h1>Full court buckets</h1>", "Full court buckets", 404), false);
assert.strictEqual(lib.livePageReady("<h1>A &amp; B</h1>", "A & B", 200), true);
assert.strictEqual(lib.isLiveSiteUrl("https://fullcourtbuckets.com/notes/a/"), true);
assert.strictEqual(lib.isLiveSiteUrl("https://api.github.com/repos/x"), false);
assert.strictEqual(lib.isLiveSiteUrl("http://fullcourtbuckets.com/"), false);
assert.strictEqual(lib.isDraftMergeError("Pull Request is still a draft"), true);
assert.strictEqual(lib.isDraftMergeError("Merge conflict"), false);
assert.strictEqual(lib.graphqlAccessError({ errors: [{ type: "FORBIDDEN", message: "Resource not accessible by personal access token" }] }), true);
assert.strictEqual(lib.graphqlAccessError({ errors: [{ message: "Pull request is not a draft" }] }), false);
assert.strictEqual(lib.graphqlMessage({ errors: [{ message: "Pull request is not a draft" }] }), "Pull request is not a draft");
var draftPending = lib.parsePending({
  action: "publish",
  repo: "ryanmoalemi/fullcourtbuckets",
  number: 84,
  nodeId: "PR_kwDO84",
  steps: { ready: "pending", merge: "pending", deploy: "pending" }
});
assert.strictEqual(draftPending.steps.ready, "pending");
assert.strictEqual(draftPending.nodeId, "PR_kwDO84");
assert.strictEqual(lib.pendingDone(draftPending), false);
assert.strictEqual(draftPending.steps.workflow, "skip");
assert.deepStrictEqual(lib.pendingNeeds(draftPending), ["Pull requests: Read and write"]);
assert.strictEqual(lib.usesPublishWorkflow("ryanmoalemi/fullcourtbuckets"), true);
assert.strictEqual(lib.usesPublishWorkflow("ryanmoalemi/ryanmoalemi.com"), false);
assert.strictEqual(lib.usesPublishWorkflow("ryanmoalemi/sandiegoadubuilder.com"), false);
var workflowNonce = "nonce84";
assert.deepStrictEqual(lib.publishWorkflowResult([
  { body: "fcb-publish:start " + workflowNonce, created_at: "2026-10-04T22:00:00Z" },
  { body: "fcb-publish:failed older\nOld failure", created_at: "2026-10-04T22:01:00Z" },
  { body: "fcb-publish:failed " + workflowNonce + "\nThe shared listings were rebuilt, but main was not changed.", created_at: "2026-10-04T22:02:00Z" }
], workflowNonce), { status: "failed", message: "The shared listings were rebuilt, but main was not changed." });
assert.deepStrictEqual(lib.publishWorkflowResult([
  { body: "fcb-publish:published " + workflowNonce + "\nPublished.", created_at: "2026-10-04T22:03:00Z" }
], workflowNonce), { status: "published", message: "" });
assert.strictEqual(lib.publishWorkflowResult([], workflowNonce).status, "pending");
var workflowPending = lib.parsePending({
  action: "publish",
  repo: "ryanmoalemi/fullcourtbuckets",
  number: 84,
  workflowNonce: workflowNonce,
  steps: { ready: "done", workflow: "pending", merge: "pending", deploy: "pending" }
});
assert.strictEqual(workflowPending.steps.workflow, "pending");
assert.strictEqual(workflowPending.workflowNonce, workflowNonce);
assert.strictEqual(workflowPending.steps.sync, "skip");
assert.strictEqual(lib.pendingDone(workflowPending), false);
assert.strictEqual(lib.isSharedListing("index.html"), true);
assert.strictEqual(lib.isSharedListing("news/index.html"), true);
assert.strictEqual(lib.isSharedListing("news/story/index.html"), false);
assert.strictEqual(lib.isSharedListing("wnba/teams/atlanta-dream/index.html"), true);
assert.strictEqual(lib.isSharedListing("images/hero.webp"), false);
assert.strictEqual(lib.isMergeConflictError(409, "Pull Request has merge conflicts"), true);
assert.strictEqual(lib.isMergeConflictError(200, "ok"), false);
var mergedArticles = lib.prepareArticles(
  [
    { slug: "older-story", title: "Older", date: "2026-10-01", description: "Old" },
    { slug: "shared-story", title: "Main title", date: "2026-10-02", description: "From main" }
  ],
  [{ slug: "shared-story", title: "PR title", date: "2026-10-04", description: "From the draft", teams: ["atlanta-dream"] }]
);
assert.strictEqual(mergedArticles[0].title, "PR title");
assert.strictEqual(mergedArticles[0].url, "/news/shared-story/");
assert.strictEqual(mergedArticles[1].slug, "older-story");
assert.strictEqual(mergedArticles.length, 2);
var plan = lib.integrationPlan(
  [
    { path: "index.html", mode: "100644", type: "blob", sha: "basehome" },
    { path: "news/story/index.html", mode: "100644", type: "blob", sha: "basepost" }
  ],
  [
    { path: "index.html", mode: "100644", type: "blob", sha: "mainhome" },
    { path: "news/story/index.html", mode: "100644", type: "blob", sha: "basepost" },
    { path: "news/index.html", mode: "100644", type: "blob", sha: "mainhub" }
  ],
  [
    { path: "index.html", mode: "100644", type: "blob", sha: "prhome" },
    { path: "news/story/index.html", mode: "100644", type: "blob", sha: "prpost" },
    { path: "news/index.html", mode: "100644", type: "blob", sha: "prhub" },
    { path: "images/a.webp", mode: "100644", type: "blob", sha: "primg" }
  ]
);
assert.deepStrictEqual(plan.overlay.map(function (entry) { return entry.path + ":" + entry.sha; }).sort(), ["images/a.webp:primg", "news/story/index.html:prpost"]);
assert.strictEqual(plan.protectedShas["news/story/index.html"], "prpost");
assert.strictEqual(lib.protectedDrift(plan.protectedShas, [{ path: "news/story/index.html", type: "blob", sha: "basepost" }], plan.overlay), "");
var home = '<div id="latest"></div><a class="feature feature-link" id="featured-story" href="/old/"><img class="feature-photo" id="featured-image" src="/old.jpg" alt="Old"></a><h1 id="featured-title">Old</h1><p id="featured-dek">Old dek</p><div class="meta" id="featured-meta">Old</div><div class="story-list" id="older-stories"></div><section id="roster">Roster stays</section><div class="ticker-text">OLD TICKER</div>';
var rebuilt = lib.rebuildSharedTexts({
  "index.html": home,
  "news/index.html": "<header>Keep this header</header><ol class=\"news-list\"><li>old</li></ol>",
  "pages-sitemap.xml": "<urlset>\n  <url><loc>https://fullcourtbuckets.com/old/</loc></url>\n</urlset>",
  "wnba/teams/atlanta-dream/index.html": "<section class=\"section\" id=\"team-news\"><p>Old news</p></section><p><a href=\"/wnba/teams/\">Teams</a></p>"
}, mergedArticles, "NEW TICKER", false);
assert.strictEqual(rebuilt.conflict, "");
assert.ok(rebuilt.files["index.html"].indexOf("PR title") !== -1);
assert.ok(rebuilt.files["index.html"].indexOf("NEW TICKER") !== -1);
assert.ok(rebuilt.files["index.html"].indexOf("Roster stays") !== -1);
assert.ok(rebuilt.files["index.html"].indexOf("OLD TICKER") === -1);
assert.ok(rebuilt.files["news/index.html"].indexOf("Keep this header") !== -1);
assert.ok(rebuilt.files["news/index.html"].indexOf("/news/shared-story/") !== -1);
assert.ok(rebuilt.files["news/index.html"].indexOf("/news/older-story/") !== -1);
assert.ok(rebuilt.files["pages-sitemap.xml"].indexOf("https://fullcourtbuckets.com/news/shared-story/") !== -1);
assert.ok(rebuilt.files["wnba/teams/atlanta-dream/index.html"].indexOf("PR title") !== -1);
assert.ok(rebuilt.files["wnba/teams/atlanta-dream/index.html"].indexOf("Teams") !== -1);
var marked = lib.rebuildSharedTexts({ "index.html": home + "\n<<<<<<<" }, mergedArticles, "", false);
assert.strictEqual(marked.conflict, "index.html");
assert.strictEqual(lib.decodeGitBlob({ encoding: "base64", content: Buffer.from("article bytes", "utf8").toString("base64") }), "article bytes");
assert.strictEqual(lib.articleTickerInner('<div class="ticker-text">NEW TICKER</div>'), "NEW TICKER");
assert.deepStrictEqual(lib.blockedPermissions(pending, [{ repo: "ryanmoalemi/fullcourtbuckets", pullsRead: true, pullsWrite: false, contentsRead: true, contentsWrite: true }]), []);
pending.steps.comment = "pending";
assert.deepStrictEqual(
  lib.blockedPermissions(pending, [{ repo: "ryanmoalemi/fullcourtbuckets", pullsRead: true, pullsWrite: false, contentsRead: true, contentsWrite: true }]),
  ["Pull requests: Read and write"]
);

var sampleDoc = "<!DOCTYPE html><html><head><title>Old title | Site</title><meta name=\"description\" content=\"Old desc\"><meta property=\"og:title\" content=\"Old title | Site\"><meta property=\"og:description\" content=\"Old desc\"><meta name=\"twitter:title\" content=\"Old title\"><script type=\"application/ld+json\">{\"headline\":\"Old title\"}</script></head><body><header><nav>Keep me</nav></header><main><article class=\"story\"><p>Inside</p></article></main><footer>Footer stays</footer></body></html>";
var spliced = lib.replaceNthElementInner(sampleDoc, "article", 0, "<p>Changed</p>");
assert.ok(spliced.indexOf("<header><nav>Keep me</nav></header>") > -1);
assert.ok(spliced.indexOf("<footer>Footer stays</footer>") > -1);
assert.ok(spliced.indexOf("{\"headline\":\"Old title\"}") > -1);
assert.ok(spliced.indexOf("<article class=\"story\"><p>Changed</p></article>") > -1);
assert.strictEqual(spliced.slice(0, spliced.indexOf("<article")), sampleDoc.slice(0, sampleDoc.indexOf("<article")));
assert.ok(spliced.endsWith(sampleDoc.slice(sampleDoc.indexOf("</article>"))));
var titled = lib.updateTitleInHtml(sampleDoc, "New title", "Old title");
assert.ok(titled.indexOf("<title>New title | Site</title>") > -1);
assert.ok(titled.indexOf("content=\"New title | Site\"") > -1);
assert.ok(titled.indexOf("content=\"New title\"") > -1);
assert.ok(titled.indexOf("{\"headline\":\"Old title\"}") > -1);
assert.strictEqual(lib.updateTitleInHtml(sampleDoc, "Old title", "Old title"), sampleDoc);
var described = lib.updateDescriptionInHtml(sampleDoc, "New desc");
assert.ok(described.indexOf("name=\"description\" content=\"New desc\"") > -1);
assert.ok(described.indexOf("property=\"og:description\" content=\"New desc\"") > -1);
assert.ok(described.indexOf("<title>Old title | Site</title>") > -1);
var applied = lib.applyArticle(sampleDoc, "article", 0, "<p>Edited</p>", { title: "New title", originalH1: "Old title", description: "New desc" });
assert.ok(applied.indexOf("<p>Edited</p>") > -1);
assert.ok(applied.indexOf("<title>New title | Site</title>") > -1);
assert.ok(applied.indexOf("content=\"New desc\"") > -1);
assert.ok(applied.indexOf("<footer>Footer stays</footer>") > -1);

console.log("node tests passed");

var { execFileSync } = require("child_process");
var os = require("os");
var domPage = "<!DOCTYPE html><meta charset=\"utf-8\"><title>dom</title><script>" +
  libSrc +
  "</script><script>" +
  "var closeScript = '<' + '/script>';" +
  "var html = '<!DOCTYPE html><html><head><title>Old title | Site</title><meta name=\"description\" content=\"Old desc\"><meta property=\"og:title\" content=\"Old title | Site\"><meta property=\"og:description\" content=\"Old desc\"></head><body><article><h1>Old title</h1><p>Hello <strong>world</strong>.</p><div class=\"layout\">Keep</div><blockquote><p>Quoted</p></blockquote><' + 'script>document.documentElement.setAttribute(\"data-script-ran\",\"yes\")' + closeScript + '</article></body></html>';" +
  "var doc = new DOMParser().parseFromString(html, 'text/html');" +
  "RMLib.markEditable(doc);" +
  "var p = doc.querySelector('article > p');" +
  "var quote = doc.querySelector('blockquote p');" +
  "var checks = [];" +
  "checks.push(['p editable', p.getAttribute('data-rm-edit') != null]);" +
  "checks.push(['quote editable', quote.getAttribute('data-rm-edit') != null]);" +
  "checks.push(['blockquote not editable', !doc.querySelector('blockquote').hasAttribute('data-rm-edit')]);" +
  "checks.push(['layout not editable', !doc.querySelector('.layout').hasAttribute('data-rm-edit')]);" +
  "checks.push(['script not editable', !doc.querySelector('script').hasAttribute('data-rm-edit')]);" +
  "var dirty = 'Hello <strong>there</strong>.' + '<' + 'script>alert(1)' + closeScript + '<img src=\"javascript:alert(1)\">';" +
  "var out = RMLib.applyEdits(html, {}, { title: 'New title', description: 'New desc', originalH1: 'Old title' });" +
  "var editMap = {};" +
  "editMap[p.getAttribute('data-rm-edit')] = dirty;" +
  "out = RMLib.applyEdits(html, editMap, { title: 'New title', description: 'New desc', originalH1: 'Old title' });" +
  "var again = new DOMParser().parseFromString(out, 'text/html');" +
  "var editedImg = again.querySelector('article > p img');" +
  "checks.push(['paragraph edited', again.querySelector('article > p').textContent === 'Hello there.']);" +
  "checks.push(['strong kept', !!again.querySelector('article > p strong')]);" +
  "checks.push(['script stripped from paragraph', !again.querySelector('article > p script')]);" +
  "checks.push(['js url stripped', !editedImg || !editedImg.getAttribute('src')]);" +
  "checks.push(['h1 unchanged', again.querySelector('h1').textContent === 'Old title']);" +
  "checks.push(['title suffix kept', again.querySelector('title').textContent === 'New title | Site']);" +
  "checks.push(['og title updated', again.querySelector('meta[property=\"og:title\"]').getAttribute('content') === 'New title | Site']);" +
  "checks.push(['meta description', again.querySelector('meta[name=\"description\"]').getAttribute('content') === 'New desc']);" +
  "checks.push(['og description', again.querySelector('meta[property=\"og:description\"]').getAttribute('content') === 'New desc']);" +
  "checks.push(['page script kept', again.querySelector('article script') && again.querySelector('article script').textContent.indexOf('data-script-ran') !== -1]);" +
  "checks.push(['no edit attr', !again.querySelector('[data-rm-edit]')]);" +
  "checks.push(['hero detect', RMLib.heroPresent(again, 'drafts/morning-reset/hero.svg') === false]);" +
  "var failed = checks.filter(function (item) { return !item[1]; }).map(function (item) { return item[0]; });" +
  "document.documentElement.setAttribute('data-result', failed.length ? 'FAIL ' + failed.join(', ') : 'PASS');" +
  "</script><p id=\"result\">pending</p>";

function chromeProfileArgs(extra) {
  return [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--user-data-dir=" + fs.mkdtempSync(path.join(os.tmpdir(), "editor-chrome-"))
  ].concat(extra);
}

var domFile = path.join(os.tmpdir(), "editor-dom-test.html");
fs.writeFileSync(domFile, domPage);
var dump = "";
try {
  dump = execFileSync("google-chrome", chromeProfileArgs([
    "--virtual-time-budget=3000",
    "--dump-dom",
    "file://" + domFile
  ]), { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  dump = err.stdout || "";
  if (String(dump).indexOf('data-result="PASS"') === -1) throw err;
}
var result = (dump.match(/data-result=\"([^\"]+)\"/) || [])[1] || "";
if (result !== "PASS") {
  console.error(dump.slice(0, 2000));
  throw new Error("DOM tests failed: " + (result || "no result"));
}
console.log("dom tests passed");

function chromeDump(file) {
  var dump = "";
  try {
    dump = execFileSync("google-chrome", chromeProfileArgs([
      "--virtual-time-budget=4000",
      "--dump-dom",
      "file://" + file
    ]), { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (err) {
    dump = err.stdout || "";
    if (String(dump).indexOf('data-result="PASS"') === -1) throw err;
  }
  return (String(dump).match(/data-result="([^"]+)"/) || [])[1] || "";
}

function flowPage(setup, after) {
  return "<!DOCTYPE html><meta charset=\"utf-8\"><title>flow</title><div id=\"app\"></div><script>" +
    setup +
    "</script><script>" +
    libSrc +
    "</script><script>" +
    editorSrc +
    "</script><script>" +
    after +
    "</script>";
}

var fetchOk = "window.fetch=function(url){var href=String(url);var body=href.indexOf('/pulls')!==-1?'[]':'{}';return Promise.resolve(new Response(body,{status:200,headers:{'Content-Type':'application/json'}}));};";
var submitFile = path.join(os.tmpdir(), "editor-submit-test.html");
fs.writeFileSync(submitFile, flowPage(
  "localStorage.removeItem('rm-editor-token');" + fetchOk,
  "var input=document.getElementById('token');input.value='github_pat_formcheck';document.querySelector('form.token-form').requestSubmit();var tries=0;function check(){tries+=1;var h1=document.querySelector('h1');var banner=document.querySelector('.banner');var stored=localStorage.getItem('rm-editor-token');var form=document.querySelector('form.token-form');if(h1&&h1.textContent==='Drafts'&&stored==='github_pat_formcheck'&&!form){document.documentElement.setAttribute('data-result','PASS');return;}if(banner&&/not a function|rejected|GitHub API/i.test(banner.textContent)){document.documentElement.setAttribute('data-result','FAIL '+banner.textContent);return;}if(tries>50){document.documentElement.setAttribute('data-result','FAIL '+(banner?banner.textContent:(h1&&h1.textContent)||'timeout'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var submitResult = chromeDump(submitFile);
if (submitResult !== "PASS") throw new Error("token submit did not open the inbox: " + (submitResult || "no result"));
console.log("submit test passed");

var bootFile = path.join(os.tmpdir(), "editor-boot-test.html");
fs.writeFileSync(bootFile, flowPage(
  "localStorage.setItem('rm-editor-token','github_pat_bootcheck');" + fetchOk,
  "var form=document.querySelector('form.token-form');var h1=document.querySelector('h1');var banner=document.querySelector('.banner');var text=banner?banner.textContent:'';var ok=!form&&h1&&h1.textContent==='Drafts'&&text.indexOf('Checking the saved token')===-1;document.documentElement.setAttribute('data-result',ok?'PASS':'FAIL '+(text||(h1&&h1.textContent)||'no inbox'));"
));
var bootResult = chromeDump(bootFile);
if (bootResult !== "PASS") throw new Error("saved token did not open the inbox: " + (bootResult || "no result"));
console.log("boot test passed");

var rejectFile = path.join(os.tmpdir(), "editor-reject-test.html");
fs.writeFileSync(rejectFile, flowPage(
  "localStorage.removeItem('rm-editor-token');window.fetch=function(){return Promise.resolve(new Response(JSON.stringify({message:'Bad credentials'}),{status:401,headers:{'Content-Type':'application/json'}}));};",
  "var input=document.getElementById('token');input.value='github_pat_rejected';document.querySelector('form.token-form').requestSubmit();var tries=0;function check(){tries+=1;var banner=document.querySelector('.banner');var stored=localStorage.getItem('rm-editor-token');var form=document.querySelector('form.token-form');if(form&&banner&&/rejected/i.test(banner.textContent)&&!stored){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>50){document.documentElement.setAttribute('data-result','FAIL stored='+stored+' '+(banner?banner.textContent:'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var rejectResult = chromeDump(rejectFile);
if (rejectResult !== "PASS") throw new Error("rejected token was stored: " + (rejectResult || "no result"));
console.log("reject test passed");

function chromeDumpBudget(file, budget) {
  var dump = "";
  try {
    dump = execFileSync("google-chrome", chromeProfileArgs([
      "--virtual-time-budget=" + String(budget),
      "--dump-dom",
      "file://" + file
    ]), { encoding: "utf8", timeout: 25000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (err) {
    dump = err.stdout || "";
    if (String(dump).indexOf('data-result="PASS"') === -1) throw err;
  }
  return (String(dump).match(/data-result="([^"]+)"/) || [])[1] || "";
}

var permissionFetch = "window.fetch=function(url,opts){var href=String(url);var method=(opts&&opts.method)||'GET';function respond(status,body,extra){var headers={'Content-Type':'application/json'};if(extra)Object.keys(extra).forEach(function(key){headers[key]=extra[key];});return Promise.resolve(new Response(JSON.stringify(body),{status:status,headers:headers}));}if(method==='GET'&&(href.indexOf('/contents')!==-1||href.indexOf('/pulls')!==-1))return respond(403,{message:'Resource not accessible by personal access token'});if(method!=='GET')return respond(403,{message:'Resource not accessible by personal access token'},{'X-Accepted-GitHub-Permissions':'contents=write'});return respond(200,{});};";
var permissionFile = path.join(os.tmpdir(), "editor-permission-test.html");
fs.writeFileSync(permissionFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_missing');" + permissionFetch,
  "var tries=0;function check(){tries+=1;var line=document.querySelector('.permission-line');var text=line?line.textContent:'';var retry=document.getElementById('retry-pending');var expected='Missing Contents: Read and write, Pull requests: Read and write on fullcourtbuckets, sandiegoadubuilder.com, ryanmoalemi.com, ryanmoalemi.app, ryanmoalemi.github.io.';if(text.indexOf(expected)===0&&line.querySelector('a')&&line.querySelector('a').href==='https://github.com/settings/personal-access-tokens'&&!retry){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>80){document.documentElement.setAttribute('data-result','FAIL '+(text||'no permission line'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var permissionResult = chromeDumpBudget(permissionFile, 8000);
if (permissionResult !== "PASS") throw new Error("permission banner missing: " + (permissionResult || "no result"));
console.log("permission banner test passed");

var noteText = "Tighten the lede and name the source. <strong>not html</strong>";
var pendingRecord = JSON.stringify({
  action: "send-back",
  repo: "ryanmoalemi/fullcourtbuckets",
  headRepo: "ryanmoalemi/fullcourtbuckets",
  number: 83,
  jsonPath: "review/buckets.json",
  branch: "draft",
  note: noteText,
  title: "Full court buckets",
  slug: "full-court-buckets",
  description: "A search line about the draft.",
  body: "<p>Keep the lede.</p>",
  files: [],
  steps: { commit: "skip", comment: "pending", label: "pending", merge: "skip" },
  savedAt: "2026-10-04T00:00:00.000Z"
});
var failFetch = "window.__sendOk=false;window.fetch=function(url,opts){var href=String(url);var method=(opts&&opts.method)||'GET';function respond(status,body,extra){var headers={'Content-Type':'application/json'};if(extra)Object.keys(extra).forEach(function(key){headers[key]=extra[key];});return Promise.resolve(new Response(JSON.stringify(body),{status:status,headers:headers}));}if(method==='GET'){return respond(200,href.indexOf('/pulls')!==-1?[]:{});}if(window.__sendOk)return respond(200,{});if(href.indexOf('/pulls/0/reviews')!==-1)return respond(404,{message:'Not Found'});if(href.indexOf('/git/commits')!==-1)return respond(422,{message:'Invalid request'});return respond(403,{message:'Resource not accessible by personal access token'},{'X-Accepted-GitHub-Permissions':'pull_requests=write'});};";
var failFile = path.join(os.tmpdir(), "editor-note-fail-test.html");
fs.writeFileSync(failFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_notes');localStorage.setItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:83:review/buckets.json'," + JSON.stringify(pendingRecord) + ");" + failFetch,
  "var tries=0;var phase='fail';function check(){tries+=1;var note=document.querySelector('.saved-note');var retry=document.getElementById('retry-pending');var banner=document.querySelector('.banner:not(.permission)');var link=banner&&banner.querySelector('a');var stored=localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:83:review/buckets.json');if(phase==='fail'){var text=banner?banner.textContent:'';var html=note&&note.querySelector('strong');if(retry&&retry.textContent==='Retry'&&note&&note.textContent.indexOf('Tighten the lede and name the source.')!==-1&&note.textContent.indexOf('<strong>not html</strong>')!==-1&&!html&&link&&link.getAttribute('href')==='https://github.com/settings/personal-access-tokens'&&text.indexOf('Pull requests: Read and write')!==-1&&text.indexOf('fullcourtbuckets')!==-1&&text.indexOf('Resource not accessible')===-1&&stored){phase='retry';window.__sendOk=true;retry.click();tries=0;setTimeout(check,40);return;}if(tries>90){document.documentElement.setAttribute('data-result','FAIL '+(text||'no error banner'));return;}setTimeout(check,40);return;}var text2=banner?banner.textContent:'';var stored2=localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:83:review/buckets.json');if(!stored2&&text2.indexOf('Sent back')!==-1&&text2.indexOf('Resource not accessible')===-1){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>90){document.documentElement.setAttribute('data-result','FAIL retry stored='+!!stored2+' '+(text2||'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var failResult = chromeDumpBudget(failFile, 12000);
if (failResult !== "PASS") throw new Error("saved note was not kept: " + (failResult || "no result"));
console.log("saved note test passed");

function draftFetch(mode, repoName, articleHtml) {
  var repo = repoName || "ryanmoalemi/fullcourtbuckets";
  var review = {
    site: "fullcourtbuckets.com",
    title: "Full court buckets",
    meta_description: "A search line about the draft.",
    summary: "A short summary of the draft.",
    url_path: "/notes/full-court-buckets/",
    files: ["notes/full-court-buckets/index.html"],
    hero_image: "",
    unique: ["Our chart"],
    unverified: [],
    scorecard: { overall: 8, max: 10 }
  };
  var article = articleHtml || "<!DOCTYPE html><html><head><title>Full court buckets</title></head><body><article><h1>Full court buckets</h1><p>Hello.</p></article></body></html>";
  var pr = {
    state: "open",
    draft: mode !== "direct",
    merged: false,
    number: 84,
    node_id: "PR_kwDO84",
    title: "Full court buckets",
    created_at: "2026-10-04T18:00:00Z",
    html_url: "https://github.com/" + repo + "/pull/84",
    base: { ref: "main" },
    head: { sha: "abc84", ref: "draft-84", repo: { full_name: repo } },
    labels: [{ name: "review" }]
  };
  var blobs = {
    artsha: JSON.stringify([{ slug: "full-court-buckets", title: "Full court buckets", description: "A search line about the draft.", date: "2026-10-04", category: "News" }]),
    homesha: '<div id="latest"></div><a class="feature feature-link" id="featured-story" href="/old/">x</a><h1 id="featured-title">Old</h1><p id="featured-dek">Old dek</p><div class="meta" id="featured-meta">Old</div><div class="story-list" id="older-stories"></div><section id="roster">Roster stays</section><div class="ticker-text">OLD TICKER</div>',
    hubsha: '<header>Keep this header</header><ol class="news-list"><li>old</li></ol>',
    postsha: '<div class="ticker-text">NEW TICKER</div><h1>Full court buckets</h1>'
  };
  var tree = [
    { path: "articles.json", mode: "100644", type: "blob", sha: "artsha" },
    { path: "index.html", mode: "100644", type: "blob", sha: "homesha" },
    { path: "news/index.html", mode: "100644", type: "blob", sha: "hubsha" },
    { path: "news/full-court-buckets/index.html", mode: "100644", type: "blob", sha: "postsha" },
    { path: "notes/full-court-buckets/index.html", mode: "100644", type: "blob", sha: "notessha" }
  ];
  return "location.hash='#review?repo=" + repo + "&pr=84';" +
    "window.__order=[];window.__written='';window.__commit='';window.__mainPatched=false;window.__denyReady=" + (mode === "deny" ? "true" : "false") + ";" +
    "window.__failSync=" + (mode === "conflict" ? "true" : "false") + ";" +
    "window.__failMerge=" + (mode === "forbidden" ? "true" : "false") + ";" +
    "window.RM_LIVE_POLL_MS=30;window.RM_LIVE_POLL_LIMIT=2000;" +
    "var PR=" + JSON.stringify(pr) + ";var REVIEW=" + JSON.stringify(review) + ";var ARTICLE=" + JSON.stringify(article) + ";var BLOBS=" + JSON.stringify(blobs) + ";var TREE=" + JSON.stringify(tree) + ";" +
    "window.fetch=function(url,opts){var href=String(url);var method=(opts&&opts.method)||'GET';var bodyText=opts&&opts.body?String(opts.body):'';function respond(status,body,type){return Promise.resolve(new Response(typeof body==='string'?body:JSON.stringify(body),{status:status,headers:{'Content-Type':type||'application/json'}}));}if(href.indexOf('api.github.com')===-1)return respond(200,'<h1>Full court buckets</h1>','text/html');if(href.indexOf('/graphql')!==-1){window.__order.push('ready');window.__readyBody=bodyText;if(window.__denyReady)return respond(403,{message:'Resource not accessible by personal access token'});return respond(200,{data:{markPullRequestReadyForReview:{pullRequest:{isDraft:false}}}});}if(method==='PUT'&&href.indexOf('/merge')!==-1){window.__order.push('merge');if(window.__failMerge)return respond(403,{message:'Resource not accessible by personal access token'});return respond(200,{merged:true});}if(method==='PATCH'&&href.indexOf('/git/refs/heads/main')!==-1){window.__order.push('main');window.__mainPatched=true;return respond(200,{object:{sha:'squashsha'}});}if(method==='PATCH'&&href.indexOf('/git/refs/heads/')!==-1){window.__order.push('sync');return respond(200,{object:{sha:'commitsha'}});}if(method==='POST'&&href.indexOf('/git/blobs')!==-1){var posted=JSON.parse(bodyText||'{}');window.__written+='\\n'+(posted.content||'');return respond(200,{sha:'newblob'});}if(method==='POST'&&href.indexOf('/git/trees')!==-1){return respond(200,{sha:'newtree'});}if(method==='POST'&&href.indexOf('/git/commits')!==-1){window.__commit=bodyText;return respond(200,{sha:'commitsha',tree:{sha:'newtree'}});}if(method==='GET'&&href.indexOf('/git/ref/heads/main')!==-1)return respond(200,{object:{sha:'mainsha'}});if(method==='GET'&&href.indexOf('/git/ref/heads/')!==-1)return respond(200,{object:{sha:'headsha'}});if(href.indexOf('/compare/')!==-1){if(window.__failSync)return respond(409,{message:'Pull Request has merge conflicts'});return respond(200,{status:'diverged',ahead_by:1,behind_by:1,merge_base_commit:{sha:'basesha'}});}if(method==='GET'&&href.indexOf('/git/commits/')!==-1)return respond(200,{sha:'commitsha',tree:{sha:'treesha'}});if(href.indexOf('/git/trees/')!==-1)return respond(200,{sha:'treesha',truncated:false,tree:TREE});if(href.indexOf('/git/blobs/')!==-1){var sha=href.split('/git/blobs/')[1].split('?')[0];return respond(200,{content:btoa(BLOBS[sha]||'notes'),encoding:'base64'});}if(href.indexOf('/pulls/84')!==-1&&href.indexOf('/files')===-1)return respond(200,PR);if(href.indexOf('review/buckets.json')!==-1)return respond(200,JSON.stringify(REVIEW),'text/plain');if(href.indexOf('/contents/review')!==-1)return respond(200,[{type:'file',name:'buckets.json'}]);if(href.indexOf('index.html')!==-1)return respond(200,ARTICLE,'text/html');if(href.indexOf('/pulls')!==-1)return respond(200,[]);return respond(200,{});};";
}

var draftFile = path.join(os.tmpdir(), "editor-draft-publish-test.html");
fs.writeFileSync(draftFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_draft');" + draftFetch("ok"),
  "var tries=0;function check(){tries+=1;var button=document.getElementById('publish');var title=document.getElementById('review-title');if(!window.__clicked&&button&&title&&title.textContent.indexOf('Full court')!==-1){window.__clicked=true;button.click();var ok=document.getElementById('modal-ok');if(ok)ok.click();}var banner=document.querySelector('.banner.publish-result')||document.querySelector('.banner');var text=banner?banner.textContent:'';var order=(window.__order||[]).join(',');var body=window.__readyBody||'';var written=window.__written||'';var commit=window.__commit||'';if(text.indexOf('Published')!==-1&&order==='sync,ready,merge'&&!window.__mainPatched&&body.indexOf('markPullRequestReadyForReview')!==-1&&body.indexOf('PR_kwDO84')!==-1&&written.indexOf('NEW TICKER')!==-1&&written.indexOf('Keep this header')!==-1&&written.indexOf('/news/full-court-buckets/')!==-1&&written.indexOf('Roster stays')!==-1&&commit.indexOf('headsha')!==-1&&commit.indexOf('mainsha')!==-1&&text.indexOf('View post')!==-1&&text.indexOf('Back to drafts')!==-1&&text.indexOf('PT')!==-1){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>160){document.documentElement.setAttribute('data-result','FAIL '+order+' main='+window.__mainPatched+' '+(text||'no banner')+' '+written.slice(0,180));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var draftResult = chromeDumpBudget(draftFile, 14000);
if (draftResult !== "PASS") throw new Error("draft pull request was not marked ready before merge: " + (draftResult || "no result"));
console.log("draft publish test passed");

var draftDenyFile = path.join(os.tmpdir(), "editor-draft-deny-test.html");
fs.writeFileSync(draftDenyFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_draftdeny');" + draftFetch("deny"),
  "var tries=0;var phase='fail';function check(){tries+=1;var button=document.getElementById('publish');var title=document.getElementById('review-title');if(!window.__clicked&&button&&title&&title.textContent.indexOf('Full court')!==-1){window.__clicked=true;button.click();var ok=document.getElementById('modal-ok');if(ok)ok.click();}var banner=document.querySelector('.banner:not(.permission)');var text=banner?banner.textContent:'';var retry=document.getElementById('retry-pending');var order=(window.__order||[]).join(',');var stored=localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:84:review/buckets.json');if(phase==='fail'){if(retry&&retry.textContent==='Retry'&&text.indexOf('still a draft')!==-1&&text.indexOf('was not merged')!==-1&&text.indexOf('live page was not changed')!==-1&&text.indexOf('Pull requests: Read and write')!==-1&&text.indexOf('fullcourtbuckets')!==-1&&text.indexOf('Resource not accessible')===-1&&order==='sync,ready'&&stored&&!window.__mainPatched){phase='retry';window.__denyReady=false;retry.click();tries=0;setTimeout(check,40);return;}if(tries>160){document.documentElement.setAttribute('data-result','FAIL '+order+' '+(text||'no banner'));return;}setTimeout(check,40);return;}if(text.indexOf('Published')!==-1&&order==='sync,ready,ready,merge'&&!window.__mainPatched&&!localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:84:review/buckets.json')){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>160){document.documentElement.setAttribute('data-result','FAIL retry '+order+' '+(text||'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var draftDenyResult = chromeDumpBudget(draftDenyFile, 16000);
if (draftDenyResult !== "PASS") throw new Error("draft permission failure was not explained: " + (draftDenyResult || "no result"));
console.log("draft permission test passed");

var conflictFile = path.join(os.tmpdir(), "editor-conflict-publish-test.html");
fs.writeFileSync(conflictFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_conflict');" + draftFetch("conflict"),
  "var tries=0;var phase='fail';function check(){tries+=1;var button=document.getElementById('publish');var title=document.getElementById('review-title');if(!window.__clicked&&button&&title&&title.textContent.indexOf('Full court')!==-1){window.__clicked=true;button.click();var ok=document.getElementById('modal-ok');if(ok)ok.click();}var banner=document.querySelector('.banner:not(.permission)');var text=banner?banner.textContent:'';var retry=document.getElementById('retry-pending');var order=(window.__order||[]).join(',');var stored=localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:84:review/buckets.json');if(phase==='fail'){if(retry&&retry.textContent==='Retry'&&text.indexOf('Publishing did not finish')!==-1&&text.indexOf('Pull Request has merge conflicts')!==-1&&text.indexOf('live page was not changed')!==-1&&text.indexOf('Resource not accessible')===-1&&order===''&&stored&&!window.__mainPatched){phase='retry';window.__failSync=false;retry.click();tries=0;setTimeout(check,40);return;}if(tries>180){document.documentElement.setAttribute('data-result','FAIL '+order+' '+(text||'no banner'));return;}setTimeout(check,40);return;}if(text.indexOf('Published')!==-1&&order==='sync,ready,merge'&&!window.__mainPatched&&!localStorage.getItem('rm-editor-pending:ryanmoalemi/fullcourtbuckets:84:review/buckets.json')){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>180){document.documentElement.setAttribute('data-result','FAIL retry '+order+' '+(text||'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var conflictResult = chromeDumpBudget(conflictFile, 18000);
if (conflictResult !== "PASS") throw new Error("conflict publish was not retried: " + (conflictResult || "no result"));
console.log("conflict publish test passed");

var directFile = path.join(os.tmpdir(), "editor-direct-publish-test.html");
fs.writeFileSync(directFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_direct');" + draftFetch("direct", "ryanmoalemi/ryanmoalemi.com"),
  "var tries=0;function check(){tries+=1;var button=document.getElementById('publish');var title=document.getElementById('review-title');if(!window.__clicked&&button&&title&&title.textContent.indexOf('Full court')!==-1){window.__clicked=true;button.click();var ok=document.getElementById('modal-ok');if(ok)ok.click();}var banner=document.querySelector('.banner.publish-result')||document.querySelector('.banner');var text=banner?banner.textContent:'';var order=(window.__order||[]).join(',');if(text.indexOf('Published')!==-1&&order==='merge'){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>140){document.documentElement.setAttribute('data-result','FAIL '+order+' '+(text||'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var directResult = chromeDumpBudget(directFile, 14000);
if (directResult !== "PASS") throw new Error("other repos did not keep the direct merge: " + (directResult || "no result"));
console.log("direct merge test passed");

var forbiddenFile = path.join(os.tmpdir(), "editor-forbidden-publish-test.html");
fs.writeFileSync(forbiddenFile, flowPage(
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_forbidden');" + draftFetch("forbidden"),
  "var tries=0;function check(){tries+=1;var button=document.getElementById('publish');var title=document.getElementById('review-title');if(!window.__clicked&&button&&title&&title.textContent.indexOf('Full court')!==-1){window.__clicked=true;button.click();var ok=document.getElementById('modal-ok');if(ok)ok.click();}var banner=document.querySelector('.banner.publish-result')||document.querySelector('.banner');var text=banner?banner.textContent:'';var order=(window.__order||[]).join(',');var commit=window.__commit||'';if(text.indexOf('Published')!==-1&&order==='sync,ready,merge,main'&&window.__mainPatched&&commit.indexOf('mainsha')!==-1&&commit.indexOf('\"force\"')===-1&&text.indexOf('View post')!==-1){document.documentElement.setAttribute('data-result','PASS');return;}if(tries>180){document.documentElement.setAttribute('data-result','FAIL '+order+' main='+window.__mainPatched+' '+(text||'no banner'));return;}setTimeout(check,40);}setTimeout(check,20);"
));
var forbiddenResult = chromeDumpBudget(forbiddenFile, 18000);
if (forbiddenResult !== "PASS") throw new Error("merge refusal did not publish to main: " + (forbiddenResult || "no result"));
console.log("forbidden merge test passed");

var previewArticle = "<!DOCTYPE html><html><head><title>Full court buckets</title><style>html,body{min-height:100vh;background:#050506;color:#fff;margin:0}.page{min-height:100vh}</style></head><body><article class=\"page\"><h1>Full court buckets</h1><p>Hello from the article.</p><p class=\"analysis-footer\">ANALYSIS. COMMENTARY.</p></article></body></html>";
var previewFile = path.join(os.tmpdir(), "editor-preview-fit.html");
fs.writeFileSync(previewFile, "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>preview fit</title><link rel=\"stylesheet\" href=\"file:///workspace/editor/editor.css\"><style>*{animation:none !important}</style></head><body><div id=\"app\"></div><script>" +
  "localStorage.clear();localStorage.setItem('rm-editor-token','github_pat_preview');" + draftFetch("direct", "ryanmoalemi/ryanmoalemi.com", previewArticle) +
  "</script><script src=\"file:///workspace/editor/lib.js\"></script><script src=\"file:///workspace/editor/roundtrip.js\"></script><script src=\"file:///workspace/editor/vendor/word.bundle.js\"></script><script src=\"file:///workspace/editor/editor.js\"></script><script>" +
  "var tries=0;function check(){tries+=1;var frame=document.getElementById('preview');var doc=frame&&frame.contentDocument;var text=doc&&doc.body?doc.body.innerText:'';var plus=doc&&doc.querySelector('.rm-plus');var frameH=frame?frame.getBoundingClientRect().height:0;var last=0;if(doc&&doc.body){var nodes=doc.body.querySelectorAll('*');for(var i=0;i<nodes.length;i++){var rect=nodes[i].getBoundingClientRect();if(rect&&rect.height>1)last=Math.max(last,rect.bottom);}}var gap=frameH-last;if(text.indexOf('ANALYSIS. COMMENTARY.')!==-1&&plus&&gap<32&&gap>-2&&frameH>40&&frameH<520){document.documentElement.setAttribute('data-gap',String(Math.round(gap)));document.documentElement.setAttribute('data-frame',String(Math.round(frameH)));document.documentElement.setAttribute('data-result','PASS');return;}if(tries>80){document.documentElement.setAttribute('data-result','FAIL gap='+Math.round(gap)+' height='+Math.round(frameH)+' plus='+!!plus+' '+(text||'no text').slice(0,120));return;}setTimeout(check,50);}setTimeout(check,400);" +
  "</script></body></html>");
var previewResult = chromeDumpBudget(previewFile, 12000);
if (!previewResult || previewResult.indexOf("PASS") !== 0) throw new Error("preview frame was taller than the article: " + (previewResult || "no result"));
console.log("preview fit test passed", previewResult);

