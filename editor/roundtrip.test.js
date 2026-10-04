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
assert.strictEqual((editorSrc.match(/fetch\s*\(/g) || []).length, 1);
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
  "editor.destroy();",
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
    "--virtual-time-budget=8000",
    "--dump-dom",
    "file://" + file
  ], { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "ignore"] });
} catch (err) {
  dump = err.stdout || "";
  if (String(dump).indexOf('data-result="PASS') === -1) throw err;
}
var result = (String(dump).match(/data-result="([^"]+)"/) || [])[1] || "";
if (result.indexOf("PASS") !== 0) {
  throw new Error("round-trip tests failed: " + (result || "no result"));
}
console.log("round-trip tests passed (" + result.slice(5) + ")");
