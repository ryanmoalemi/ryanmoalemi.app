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
assert.strictEqual((editorSrc.match(/fetch\s*\(/g) || []).length, 1);

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

var domFile = path.join(os.tmpdir(), "editor-dom-test.html");
fs.writeFileSync(domFile, domPage);
var dump = "";
try {
  dump = execFileSync("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=3000",
    "--dump-dom",
    "file://" + domFile
  ], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
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
    dump = execFileSync("google-chrome", [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--virtual-time-budget=4000",
      "--dump-dom",
      "file://" + file
    ], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
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

