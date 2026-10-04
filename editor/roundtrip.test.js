var assert = require("assert");
var fs = require("fs");
var path = require("path");
var os = require("os");
var { execFileSync } = require("child_process");

var editorSrc = fs.readFileSync(path.join(__dirname, "editor.js"), "utf8");
var roundtripSrc = fs.readFileSync(path.join(__dirname, "roundtrip.js"), "utf8");
["editor.js", "roundtrip.js", "src/word.js", "editor.css", "index.html"].forEach(function (file) {
  var src = fs.readFileSync(path.join(__dirname, file), "utf8");
  assert.strictEqual(src.indexOf("\u2014"), -1, file + " has an em dash");
});
assert.strictEqual((editorSrc.match(/fetch\s*\(/g) || []).length, 2);
assert.ok(editorSrc.indexOf("Show my edits") > -1);
assert.ok(editorSrc.indexOf("Search description") > -1);
assert.ok(editorSrc.indexOf("fidelityCheck") > -1);
assert.ok(roundtripSrc.indexOf("These edits were not saved.") > -1);
assert.ok(roundtripSrc.indexOf("nothing was changed on GitHub") > -1);

var synthetic = [
  "<!DOCTYPE html><html><head>",
  "<title>Collected: Card night | Full Court Buckets</title>",
  "<meta name=\"description\" content=\"A draft about cards.\">",
  "<meta property=\"og:title\" content=\"Collected: Card night | Full Court Buckets\">",
  "<meta property=\"og:description\" content=\"A draft about cards.\">",
  "<meta name=\"twitter:title\" content=\"Collected: Card night | Full Court Buckets\">",
  "<meta name=\"twitter:description\" content=\"A draft about cards.\">",
  "<script type=\"application/ld+json\">{\"@type\":\"Article\",\"headline\":\"Card night\"}</script>",
  "</head><body>",
  "<header><a href=\"/\">Home</a></header>",
  "<main><article class=\"article\" data-kind=\"story\">",
  "<h1>Card night</h1>",
  "<p>Hello <strong>bold</strong> and <em>italic</em> and <u>line</u>.</p>",
  "<h2 class=\"section\">Lineup</h2>",
  "<figure class=\"photo\" data-credit=\"arena\"><img src=\"img/hero.webp\" alt=\"Arena photo\" width=\"640\"><figcaption>Photo by <a href=\"https://example.com/credit\" target=\"_blank\" rel=\"noopener noreferrer\">Arena desk</a>.</figcaption></figure>",
  "<div class=\"table-wrap\"><table class=\"stats\"><thead><tr><th>Player</th><th>Points</th></tr></thead><tbody><tr><td>Reese</td><td>22</td></tr></tbody></table></div>",
  "<ul><li>First note</li><li>Second <a class=\"source\" href=\"/notes\">note</a></li></ul>",
  "<ol class=\"sources\"><li><a href=\"https://example.com/box\">Box score</a></li></ol>",
  "<p><a class=\"byline\" href=\"/ryan\"><img src=\"img/ryan.webp\" alt=\"\"> <span>Ryan Moalemi</span></a></p>",
  "</article></main>",
  "<footer>Keep this footer byte for byte.</footer>",
  "<script type=\"application/ld+json\">{\"@type\":\"BreadcrumbList\"}</script>",
  "</body></html>"
].join("");

var fixtures = { synthetic: synthetic };
["/tmp/fcb.html", "/tmp/adu.html", "/tmp/permit.html"].forEach(function (file) {
  if (fs.existsSync(file)) fixtures[path.basename(file, ".html")] = fs.readFileSync(file, "utf8");
});

var browserJs = [
  "function fail(message) { throw new Error(message); }",
  "function sigDiff(a, b, trail) {",
  "  trail = trail || 'root';",
  "  if (a === b) return '';",
  "  if (!a || !b || typeof a !== 'object') return trail + ' ' + JSON.stringify(a) + ' != ' + JSON.stringify(b);",
  "  if (Array.isArray(a) || Array.isArray(b)) {",
  "    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return trail + ' length ' + (a && a.length) + ' != ' + (b && b.length);",
  "    for (var i = 0; i < a.length; i++) { var child = sigDiff(a[i], b[i], trail + '[' + i + ']'); if (child) return child; }",
  "    return '';",
  "  }",
  "  var keys = Object.keys(a).concat(Object.keys(b).filter(function (key) { return !Object.prototype.hasOwnProperty.call(a, key); }));",
  "  for (var k = 0; k < keys.length; k++) { var next = sigDiff(a[keys[k]], b[keys[k]], trail + '.' + keys[k]); if (next) return next; }",
  "  return '';",
  "}",
  "function roundTripInner(html) {",
  "  var doc = RMRoundtrip.parseHtml(html);",
  "  var address = RMRoundtrip.rootAddress(doc);",
  "  var inner = RMRoundtrip.extractInner(html, address.tag, address.index);",
  "  var json = RMRoundtrip.parseFragment(inner);",
  "  return { inner: inner, json: json, serialized: RMRoundtrip.serializeDoc(json) };",
  "}",
  "function assertRoundTrip(label, html) {",
  "  var trip = roundTripInner(html);",
  "  var preserve = RMRoundtrip.preservesFragment(trip.inner, trip.serialized);",
  "  if (!preserve.ok) fail(label + ' parser dropped markup ' + JSON.stringify(preserve));",
  "  var again = RMRoundtrip.serializeDoc(RMRoundtrip.parseFragment(trip.serialized));",
  "  var stable = sigDiff(RMRoundtrip.fragmentSignature(trip.serialized), RMRoundtrip.fragmentSignature(again));",
  "  if (stable) fail(label + ' serializer is not stable: ' + stable);",
  "  var structural = sigDiff(RMRoundtrip.fragmentSignature(trip.inner), RMRoundtrip.fragmentSignature(trip.serialized));",
  "  if (structural) fail(label + ' structure changed: ' + structural);",
  "  var mount = document.getElementById('mount');",
  "  mount.innerHTML = '';",
  "  var editor = RMWord.createWordEditor({ element: mount, doc: trip.json, resolveSrc: function (src) { return src; } });",
  "  var through = RMRoundtrip.serializeDoc(editor.getJSON());",
  "  var editorPreserve = RMRoundtrip.preservesFragment(trip.inner, through);",
  "  if (!editorPreserve.ok) fail(label + ' editor dropped markup ' + JSON.stringify(editorPreserve));",
  "  var editorDiff = sigDiff(RMRoundtrip.fragmentSignature(trip.serialized), RMRoundtrip.fragmentSignature(through));",
  "  if (editorDiff) fail(label + ' editor changed structure: ' + editorDiff);",
  "  editor.destroy();",
  "  mount.innerHTML = '';",
  "  var spliced = RMRoundtrip.applyDocument(html, trip.serialized, {});",
  "  var check = RMRoundtrip.fidelityCheck(html, spliced, trip.serialized);",
  "  if (!check.ok) fail(label + ' ' + check.message);",
  "  var origLd = RMRoundtrip.jsonLd(RMRoundtrip.parseHtml(html));",
  "  var nextLd = RMRoundtrip.jsonLd(RMRoundtrip.parseHtml(spliced));",
  "  if (JSON.stringify(origLd) !== JSON.stringify(nextLd)) fail(label + ' JSON-LD changed');",
  "  return trip;",
  "}",
  "var names = Object.keys(FIXTURES);",
  "names.forEach(function (name) { assertRoundTrip(name, FIXTURES[name]); });",
  "var trip = roundTripInner(FIXTURES.synthetic);",
  "var titled = RMRoundtrip.applyDocument(FIXTURES.synthetic, trip.serialized, { title: 'Card morning', description: 'A revised draft.', originalH1: 'Card night' });",
  "if (titled.indexOf('<title>Collected: Card morning | Full Court Buckets</title>') === -1) fail('title suffix dropped');",
  "if (titled.indexOf('content=\"Collected: Card morning | Full Court Buckets\"') === -1) fail('og title not updated');",
  "if (titled.indexOf('name=\"description\" content=\"A revised draft.\"') === -1) fail('description not updated');",
  "var footerAt = FIXTURES.synthetic.indexOf('<footer>');",
  "if (titled.slice(titled.indexOf('<footer>')) !== FIXTURES.synthetic.slice(footerAt)) fail('footer bytes changed');",
  "var dropped = trip.serialized.replace(/<img\\b[^>]*>/, '');",
  "var bad = RMRoundtrip.applyDocument(FIXTURES.synthetic, dropped, {});",
  "var failed = RMRoundtrip.fidelityCheck(FIXTURES.synthetic, bad, trip.serialized);",
  "if (failed.ok || !/photo/i.test(failed.message) || !/nothing was changed on GitHub/i.test(failed.message)) fail(failed.message || 'expected a photo warning');",
  "var allowed = RMRoundtrip.fidelityCheck(FIXTURES.synthetic, bad, dropped);",
  "if (!allowed.ok) fail('a deletion Ryan made should still be allowed');",
  "var mount = document.getElementById('mount');",
  "var editor = RMWord.createWordEditor({ element: mount, doc: trip.json });",
  "var images = RMWord.listImages(editor);",
  "if (images.length < 2) fail('expected images in the synthetic draft');",
  "if (!RMWord.setImageAlt(editor, 0, 'Updated arena alt')) fail('could not set alt text');",
  "var afterAlt = RMRoundtrip.serializeDoc(editor.getJSON());",
  "if (afterAlt.indexOf('alt=\"Updated arena alt\"') === -1) fail('alt text was not written');",
  "if (afterAlt.indexOf('img/hero.webp') === -1) fail('image src changed when alt was edited');",
  "if (!RMWord.setH1Text(editor, 'Card morning') || RMWord.getH1Text(editor) !== 'Card morning') fail('title field did not update the heading');",
  "editor.commands.setTextSelection(2);",
  "var selected = RMWord.selectionRange(editor);",
  "RMWord.addComment(editor, 'c1', 'Check this line', { from: selected.from, to: selected.from + 4 });",
  "var notes = RMWord.listComments(editor);",
  "if (notes.length !== 1 || notes[0].note !== 'Check this line') fail('comment was not stored');",
  "if (RMRoundtrip.serializeDoc(editor.getJSON()).indexOf('Check this line') !== -1) fail('comments must not be written into the page HTML');",
  "RMWord.toggleBold(editor);",
  "RMWord.undo(editor);",
  "var loaded = RMRoundtrip.serializeDoc(editor.getJSON());",
  "if (loaded.indexOf('Arena desk') === -1 || loaded.indexOf('https://example.com/credit') === -1) fail('caption was rewritten on load');",
  "var figurePos = RMWord.listImages(editor)[0].pos;",
  "RMWord.setFigureFields(editor, figurePos, { credit: '', source: '' });",
  "var untouched = RMRoundtrip.serializeDoc(editor.getJSON());",
  "if (untouched.indexOf('Arena desk') === -1) fail('empty credit rewrote the caption');",
  "RMWord.setFigureFields(editor, figurePos, { alt: 'Night arena', width: '800', height: '450', credit: 'Goldin', source: 'https://goldin.example/lot' });",
  "var credited = RMRoundtrip.serializeDoc(editor.getJSON());",
  "if (credited.indexOf('Arena desk') === -1) fail('credit removed the caption');",
  "if (credited.indexOf('Goldin') === -1 || credited.indexOf('https://goldin.example/lot') === -1 || credited.indexOf('class=\"credit\"') === -1) fail('credit was not saved');",
  "if (credited.indexOf('alt=\"Night arena\"') === -1 || credited.indexOf('width=\"800\"') === -1 || credited.indexOf('height=\"450\"') === -1) fail('image fields were not saved');",
  "if (credited.indexOf('img/hero.webp') === -1) fail('image src changed');",
  "var imgCount = (credited.match(/<img\\b/g) || []).length;",
  "RMWord.moveBlock(editor, 0, 1);",
  "if ((RMRoundtrip.serializeDoc(editor.getJSON()).match(/<img\\b/g) || []).length !== imgCount) fail('reorder dropped an image');",
  "if (!RMWord.insertBlock(editor, 'quote', 0, 'after')) fail('could not insert a quote');",
  "if (!RMWord.insertBlock(editor, 'table', 0, 'after')) fail('could not insert a table');",
  "if (!RMWord.insertBlock(editor, 'cards', 0, 'after')) fail('could not insert a card grid');",
  "if (!RMWord.insertBlock(editor, 'faq', 0, 'after')) fail('could not insert an FAQ');",
  "var inserted = RMRoundtrip.serializeDoc(editor.getJSON());",
  "if (inserted.indexOf('<blockquote>') === -1) fail('quote block missing');",
  "if (inserted.indexOf('<table>') === -1) fail('table block missing');",
  "if (inserted.indexOf('grid cards') === -1) fail('card grid missing');",
  "if (inserted.indexOf('<details>') === -1 || inserted.indexOf('<summary>') === -1) fail('FAQ block missing');",
  "editor.destroy();",
  "if (RMRoundtrip.nextUrlPath('/news/old-slug/', 'new-slug') !== '/news/new-slug/') fail('slug path');",
  "if (RMRoundtrip.nextFilePath('news/old-slug/index.html', 'old-slug', 'new-slug') !== 'news/new-slug/index.html') fail('file path');",
  "if (RMRoundtrip.nextFilePath('index.html', '', 'guide') !== 'index.html') fail('home file should stay put');",
  "if (RMRoundtrip.uploadImagePath('news/old-slug/index.html', 'My Photo.PNG') !== 'news/old-slug/img/my-photo.webp') fail('upload path');",
  "var faqHtml = '<!DOCTYPE html><html><head><script type=\"application/ld+json\">{\"@type\":\"WebSite\",\"name\":\"ADU\"}</' + 'script></head><body><main><section id=\"faq\"><h2>Common questions</h2><div class=\"grid cards\"><article class=\"card\"><h3>How much?</h3><p>It varies by lot.</p></article></div></section></main><script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\",\"mainEntity\":[{\"@type\":\"Question\",\"name\":\"How much?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"See the county fee schedule.\"}}]}</' + 'script></body></html>';",
  "var faqTrip = roundTripInner(faqHtml);",
  "var faqSame = RMRoundtrip.applyDocument(faqHtml, faqTrip.serialized, { faqs: RMRoundtrip.extractFragmentFaqs(faqTrip.serialized), originalFaqs: RMRoundtrip.extractFragmentFaqs(faqTrip.inner) });",
  "if (faqSame.indexOf('See the county fee schedule.') === -1) fail('unchanged FAQ rewrote the search summary');",
  "if (faqSame.indexOf('{\"@type\":\"WebSite\",\"name\":\"ADU\"}') === -1) fail('website summary changed');",
  "var faqEdited = faqTrip.serialized.replace('It varies by lot.', 'It starts near 200000.');",
  "var faqNext = RMRoundtrip.applyDocument(faqHtml, faqEdited, { faqs: RMRoundtrip.extractFragmentFaqs(faqEdited), originalFaqs: RMRoundtrip.extractFaqs(faqHtml) });",
  "if (faqNext.indexOf('{\"@type\":\"WebSite\",\"name\":\"ADU\"}') === -1) fail('website summary was rewritten with the FAQ');",
  "if (faqNext.indexOf('See the county fee schedule.') !== -1) fail('old FAQ answer was kept');",
  "if (faqNext.indexOf('It starts near 200000.') === -1) fail('new FAQ answer was not saved');",
  "var faqCheck = RMRoundtrip.fidelityCheck(faqHtml, faqNext, faqEdited);",
  "if (!faqCheck.ok) fail(faqCheck.message);",
  "var faqGone = faqEdited.replace(/<article class=\"card\">[\\s\\S]*?<\\/article>/, '');",
  "var faqCleared = RMRoundtrip.applyDocument(faqHtml, faqGone, { faqs: RMRoundtrip.extractFragmentFaqs(faqGone), originalFaqs: RMRoundtrip.extractFaqs(faqHtml) });",
  "if (faqCleared.indexOf('FAQPage') !== -1) fail('FAQ summary remained after the questions were removed');",
  "if (faqCleared.indexOf('WebSite') === -1) fail('website summary was removed with the FAQ');",
  "var faqClearCheck = RMRoundtrip.fidelityCheck(faqHtml, faqCleared, faqGone);",
  "if (!faqClearCheck.ok) fail(faqClearCheck.message);",
  "document.documentElement.setAttribute('data-result', 'PASS ' + names.join(','));"
].join("\n");

var page = "<!DOCTYPE html><meta charset=\"utf-8\"><title>roundtrip</title><div id=\"mount\"></div><script>" +
  roundtripSrc +
  "</script><script>" +
  fs.readFileSync(path.join(__dirname, "vendor/word.bundle.js"), "utf8") +
  "</script><script>var FIXTURES = " + JSON.stringify(fixtures).replace(/</g, "\\u003c") + ";\ntry {\n" +
  browserJs +
  "\n} catch (err) { document.documentElement.setAttribute('data-result', 'FAIL ' + String(err && err.message || err).replace(/\"/g, \"'\")); }</script>";

var file = path.join(os.tmpdir(), "editor-roundtrip-test.html");
fs.writeFileSync(file, page);
var dump = "";
try {
  dump = execFileSync("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=20000",
    "--dump-dom",
    "file://" + file
  ], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  dump = err.stdout || "";
  if (String(dump).indexOf('data-result="PASS') === -1) throw err;
}
var result = (String(dump).match(/data-result="([^"]+)"/) || [])[1] || "";
if (result.indexOf("PASS") !== 0) {
  throw new Error("round-trip tests failed: " + (result || "no result"));
}
console.log("round-trip tests passed (" + result.slice(5) + ")");

var wordJs = fs.readFileSync(path.join(__dirname, "src/word.js"), "utf8");
assert.ok(wordJs.indexOf('canvas.toBlob') > -1);
assert.ok(wordJs.indexOf('"image/webp"') > -1);
assert.ok(wordJs.indexOf("This browser could not make a WebP image.") > -1);
var webpPage = "<!DOCTYPE html><meta charset=\"utf-8\"><script>" +
  "var png = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');" +
  "var bytes = new Uint8Array(png.length); for (var i = 0; i < png.length; i++) bytes[i] = png.charCodeAt(i);" +
  "var url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));" +
  "var img = new Image(); img.onload = function () {" +
  "var canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;" +
  "canvas.getContext('2d').drawImage(img, 0, 0);" +
  "canvas.toBlob(function (blob) {" +
  "document.documentElement.setAttribute('data-result', blob && blob.type === 'image/webp' && canvas.width > 0 ? 'PASS webp ' + canvas.width + 'x' + canvas.height : 'FAIL webp');" +
  "}, 'image/webp', 0.82); }; img.onerror = function () { document.documentElement.setAttribute('data-result', 'FAIL image'); }; img.src = url;</script>";
var webpFile = path.join(os.tmpdir(), "editor-webp-test.html");
fs.writeFileSync(webpFile, webpPage);
var webpDump = "";
try {
  webpDump = execFileSync("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=3000",
    "--dump-dom",
    "file://" + webpFile
  ], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  webpDump = err.stdout || "";
}
var webpResult = (String(webpDump).match(/data-result="([^"]+)"/) || [])[1] || "";
if (webpResult.indexOf("PASS") !== 0) throw new Error("webp conversion failed: " + (webpResult || "no result"));
console.log(webpResult);

assert.ok(editorSrc.indexOf("body:not(.rm-preview)[data-rm-keep] > :not([data-rm-keep]):not([data-rm-root]), body:not(.rm-preview) [data-rm-keep] > :not([data-rm-keep]):not([data-rm-root]) { display: none !important; }") > -1);
assert.ok(editorSrc.indexOf("body:not(.rm-preview) header, body:not(.rm-preview) footer, body:not(.rm-preview) nav, body:not(.rm-preview) .utility, body:not(.rm-preview) .ticker, body:not(.rm-preview) .site-nav, body:not(.rm-preview) .meta-row, body:not(.rm-preview) .rm-block:has(.meta-row) { display: none !important; }") > -1);
assert.ok(editorSrc.indexOf("body:not(.rm-preview) nav.site-nav > ul, body:not(.rm-preview) .site-nav > ul { display: none !important; }") > -1);
assert.ok(editorSrc.indexOf("body.rm-preview nav.site-nav:not(.is-open) > ul { display: none !important; }") > -1);
assert.ok(editorSrc.indexOf("function bindSiteNav") > -1);
assert.ok(editorSrc.indexOf("function parkSiteChrome") > -1);
assert.ok(editorSrc.indexOf("function restoreSiteChrome") > -1);
var chromePage = "<!DOCTYPE html><meta charset=\"utf-8\"><style>" +
  "body:not(.rm-preview)[data-rm-keep] > :not([data-rm-keep]):not([data-rm-root]), body:not(.rm-preview) [data-rm-keep] > :not([data-rm-keep]):not([data-rm-root]) { display: none !important; }" +
  "#rm-parked-chrome, [data-rm-slot] { display: none !important; }" +
  "body:not(.rm-preview) header, body:not(.rm-preview) footer, body:not(.rm-preview) nav, body:not(.rm-preview) .utility, body:not(.rm-preview) .ticker, body:not(.rm-preview) .site-nav, body:not(.rm-preview) .meta-row, body:not(.rm-preview) .rm-block:has(.meta-row) { display: none !important; }" +
  "body:not(.rm-preview) nav.site-nav > ul, body:not(.rm-preview) .site-nav > ul { display: none !important; }" +
  "@media (max-width: 900px) {" +
  "body.rm-preview nav.site-nav:not(.is-open) > ul { display: none !important; }" +
  "body.rm-preview nav.site-nav.is-open > ul { display: block !important; }" +
  "}</style><body data-rm-keep>" +
  "<div class=\"utility\">Utility</div>" +
  "<header><nav class=\"site-nav\"><button type=\"button\" class=\"site-nav-toggle\">Menu</button><ul id=\"site-nav-menu\"><li>Home</li></ul></nav></header>" +
  "<main data-rm-keep><nav class=\"breadcrumbs\">Crumb</nav><article data-rm-root><div class=\"rm-block\"><div class=\"meta-row\">Collecting</div></div><h1>Headline</h1></article></main>" +
  "<footer>Foot</footer>" +
  "<script>" +
  "function show(el){return getComputedStyle(el).display;}" +
  "var utility=document.querySelector('.utility');" +
  "var header=document.querySelector('header');" +
  "var crumb=document.querySelector('.breadcrumbs');" +
  "var title=document.querySelector('h1');" +
  "var meta=document.querySelector('.meta-row');" +
  "var metaBlock=document.querySelector('.rm-block');" +
  "var menu=document.getElementById('site-nav-menu');" +
  "var nav=document.querySelector('nav.site-nav');" +
  "var edit=[show(utility),show(header),show(crumb),show(title),show(meta),show(metaBlock)].join(',');" +
  "var park=document.createElement('div'); park.id='rm-parked-chrome'; park.hidden=true; document.body.appendChild(park);" +
  "var slot=document.createElement('span'); slot.setAttribute('data-rm-slot','c0'); slot.hidden=true; header.parentNode.insertBefore(slot, header); header.setAttribute('data-rm-parked-id','c0'); park.appendChild(header);" +
  "var parked=document.getElementById('rm-parked-chrome').contains(header) && show(park)==='none';" +
  "document.body.classList.add('rm-preview');" +
  "slot.parentNode.insertBefore(header, slot);" +
  "var preview=[show(header),show(title),show(menu),show(meta)].join(',');" +
  "nav.classList.add('is-open');" +
  "var open=show(menu);" +
  "var width=window.innerWidth;" +
  "var ok=edit==='none,none,none,block,none,none' && parked && preview==='block,block,none,block' && open==='block';" +
  "document.documentElement.setAttribute('data-result', (ok ? 'PASS chrome ' : 'FAIL ') + edit + ' | ' + preview + ' | ' + open + ' | parked=' + parked + ' | ' + width);" +
  "</script>";
var chromeFile = path.join(os.tmpdir(), "editor-chrome-test.html");
fs.writeFileSync(chromeFile, chromePage);
var chromeDump = "";
try {
  chromeDump = execFileSync("google-chrome", [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=390,844",
    "--virtual-time-budget=2000",
    "--dump-dom",
    "file://" + chromeFile
  ], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  chromeDump = err.stdout || "";
}
var chromeResult = (String(chromeDump).match(/data-result="([^"]+)"/) || [])[1] || "";
if (chromeResult.indexOf("PASS") !== 0) throw new Error("article chrome test failed: " + (chromeResult || "no result"));
console.log(chromeResult);
