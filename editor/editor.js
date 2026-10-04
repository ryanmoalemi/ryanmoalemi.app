(function () {
  var lib = window.RMLib;
  var app = document.getElementById("app");
  var token = "";
  var state = {
    screen: "boot",
    error: "",
    notice: "",
    loading: false,
    warnings: [],
    drafts: [],
    draft: null,
    dirty: false,
    busy: "",
    reviewHash: ""
  };
  var session = null;
  var inboxLoaded = false;
  var ignoreHash = false;
  var lock = false;

  var PREVIEW_CSS = [
    "[data-rm-edit]:hover { outline: 1px dashed rgba(124, 245, 200, 0.75); outline-offset: 4px; }",
    "[data-rm-edit]:focus { outline: 2px solid #7cf5c8; outline-offset: 4px; }",
    "[data-rm-meta] { display: block; margin: 0 0 1.1rem; padding: 0.75rem 0.85rem; border: 1px dashed rgba(124, 245, 200, 0.65); border-radius: 12px; background: rgba(7, 8, 12, 0.78); color: #f4f6fb; font: 500 0.98rem/1.45 'DM Sans', system-ui, sans-serif; }",
    "[data-rm-meta]:focus { outline: 2px solid #7cf5c8; }",
    "[data-rm-meta]::before { content: 'Meta description'; display: block; margin-bottom: 0.25rem; font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: #7cf5c8; }",
    "[data-rm-hero] { margin: 0 0 1rem; }",
    "[data-rm-hero] img { width: 100%; height: auto; display: block; }"
  ].join("\n");

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    var list = Array.isArray(kids) ? kids : (kids == null ? [] : [kids]);
    list.forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function apiUrl(path) {
    if (path.indexOf("https://") === 0) return path;
    return "https://api.github.com" + (path.charAt(0) === "/" ? path : "/" + path);
  }

  async function apiFetch(url, opts) {
    opts = opts || {};
    if (!lib.isGitHubApiUrl(url)) {
      throw new Error("Refusing to send the token anywhere but api.github.com");
    }
    var headers = new Headers();
    headers.set("Authorization", "Bearer " + token);
    headers.set("Accept", opts.raw ? "application/vnd.github.raw" : "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    if (opts.body != null) headers.set("Content-Type", "application/json");
    var res;
    try {
      res = await fetch(url, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body != null ? JSON.stringify(opts.body) : undefined
      });
    } catch (err) {
      throw new Error("Could not reach api.github.com.");
    }
    if (!res.ok) {
      var message = "GitHub API error " + res.status;
      try {
        var data = await res.json();
        if (data && data.message) message = data.message;
      } catch (parseErr) { /* keep status message */ }
      var error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return res;
  }

  async function apiJson(path, opts) {
    var res = await apiFetch(apiUrl(path), opts || {});
    if (res.status === 204) return null;
    var text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  async function apiPaged(path) {
    var url = apiUrl(path);
    var all = [];
    var guard = 0;
    while (url && guard < 10) {
      guard += 1;
      var res = await apiFetch(url, {});
      var page = await res.json();
      if (Array.isArray(page)) all = all.concat(page);
      url = lib.nextLink(res.headers.get("Link"));
    }
    return all;
  }

  function readStoredToken() {
    try { return lib.cleanToken(localStorage.getItem(lib.TOKEN_KEY) || ""); }
    catch (err) { return ""; }
  }

  function writeStoredToken(value) {
    localStorage.setItem(lib.TOKEN_KEY, value);
  }

  function clearStoredToken() {
    try { localStorage.removeItem(lib.TOKEN_KEY); }
    catch (err) { /* private mode */ }
  }

  async function assertToken() {
    var last = null;
    for (var i = 0; i < lib.REPOS.length; i++) {
      try {
        await apiJson("/repos/" + lib.REPOS[i]);
        return;
      } catch (err) {
        last = err;
        if (err.status === 401) {
          throw new Error("GitHub rejected that token. Copy the full github_pat_ value and try again.");
        }
      }
    }
    throw last || new Error("No access to the draft repositories.");
  }

  function parseRoute() {
    var raw = String(location.hash || "").replace(/^#/, "");
    if (!raw || raw === "/" || raw === "/inbox") return { name: "inbox" };
    if (raw.indexOf("review") === 0) {
      var query = raw.replace(/^review\??/, "");
      var params = new URLSearchParams(query);
      return {
        name: "review",
        repo: params.get("repo") || "",
        pr: Number(params.get("pr")),
        json: params.get("json") || ""
      };
    }
    return { name: "inbox" };
  }

  function reviewHash(draft) {
    var params = new URLSearchParams();
    params.set("repo", draft.repo);
    params.set("pr", String(draft.number));
    if (draft.jsonPath) params.set("json", draft.jsonPath);
    return "#review?" + params.toString();
  }

  function textOf(value) {
    if (value == null || value === "") return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) {
      return value.map(textOf).filter(Boolean).join(" ");
    }
    if (typeof value === "object") {
      if (value.summary) return String(value.summary);
      if (value.text) return String(value.text);
      if (value.claim) return String(value.claim);
      try { return JSON.stringify(value); }
      catch (err) { return ""; }
    }
    return String(value);
  }

  var starSeq = 0;
  var STAR_PATH = "M12 2.2 14.7 8.6 21.6 9.2 16.4 13.8 18 20.6 12 17 6 20.6 7.6 13.8 2.4 9.2 9.3 8.6Z";

  function svgEl(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }

  function starSvg(state) {
    starSeq += 1;
    var svg = svgEl("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "star " + state);
    svg.setAttribute("aria-hidden", "true");
    if (state === "half") {
      var id = "star-clip-" + starSeq;
      var defs = svgEl("defs");
      var clip = svgEl("clipPath");
      clip.setAttribute("id", id);
      var rect = svgEl("rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", "12");
      rect.setAttribute("height", "24");
      clip.append(rect);
      defs.append(clip);
      svg.append(defs);
      var base = svgEl("path");
      base.setAttribute("class", "base");
      base.setAttribute("d", STAR_PATH);
      var fill = svgEl("path");
      fill.setAttribute("class", "fill");
      fill.setAttribute("d", STAR_PATH);
      fill.setAttribute("clip-path", "url(#" + id + ")");
      svg.append(base, fill);
      return svg;
    }
    var path = svgEl("path");
    path.setAttribute("d", STAR_PATH);
    svg.append(path);
    return svg;
  }

  function starsNode(count) {
    var label = lib.starLabel(count);
    var wrap = el("span", { class: "stars", role: "img", "aria-label": label || "No score" });
    var shown = count == null ? 0 : count;
    for (var i = 0; i < 5; i++) {
      var state = "empty";
      if (shown >= i + 1) state = "full";
      else if (shown >= i + 0.5) state = "half";
      wrap.append(starSvg(state));
    }
    return wrap;
  }

  function badgeNode(badge) {
    return el("span", { class: "badge " + (badge && badge.key || "missing") }, (badge && badge.label) || "No score");
  }

  function scoreBits(meta) {
    var sc = (meta && meta.scorecard) || {};
    var overall = lib.overallScore(sc);
    if (overall == null) return null;
    var max = lib.scoreMax(sc);
    return {
      overall: overall,
      max: max,
      stars: lib.starCount(overall, max),
      badge: lib.badgeFor(sc),
      text: "Overall " + overall + "/" + max
    };
  }

  function setBanner(parent, message, kind) {
    var existing = parent.querySelector(".banner");
    if (!message) {
      if (existing) existing.remove();
      return;
    }
    var node = existing || el("div", { class: "banner", role: kind === "ok" ? "status" : "alert" });
    node.className = "banner" + (kind === "ok" ? " ok" : "");
    node.textContent = message;
    if (!existing) parent.insertBefore(node, parent.children[1] || null);
  }

  async function loadPrDrafts(repo, pr) {
    var headRepo = (pr.head && pr.head.repo && pr.head.repo.full_name) || repo;
    var sha = pr.head && pr.head.sha;
    var branch = pr.head && pr.head.ref;
    var labels = pr.labels || [];
    var paths = [];
    try {
      var listing = await apiJson("/repos/" + headRepo + "/contents/review?ref=" + encodeURIComponent(sha));
      if (Array.isArray(listing)) {
        paths = listing.filter(function (file) {
          return file.type === "file" && /^[^/]+\.json$/i.test(file.name);
        }).map(function (file) { return "review/" + file.name; });
      }
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    if (!paths.length) {
      var changed = await apiPaged("/repos/" + repo + "/pulls/" + pr.number + "/files?per_page=100");
      paths = lib.reviewJsonPaths(changed.map(function (file) { return file.filename; }));
    }
    var base = {
      repo: repo,
      headRepo: headRepo,
      number: pr.number,
      branch: branch,
      sha: sha,
      createdAt: pr.created_at,
      htmlUrl: pr.html_url,
      labels: labels.map(function (label) { return label.name; }),
      changesRequested: lib.hasLabel(labels, "changes-requested")
    };
    if (!paths.length) {
      return [Object.assign({}, base, {
        title: pr.title || "Untitled draft",
        site: repo.split("/")[1],
        missing: true,
        badge: { key: "missing", label: "No score" },
        meta: {}
      })];
    }
    var drafts = [];
    for (var i = 0; i < paths.length; i++) {
      var jsonText = await textAt(headRepo, paths[i], sha);
      try {
        var meta = lib.parseReview(jsonText);
        drafts.push(Object.assign({}, base, {
          jsonPath: paths[i],
          jsonText: jsonText,
          meta: meta,
          title: meta.title || pr.title || "Untitled draft",
          site: meta.site || repo.split("/")[1],
          badge: lib.badgeFor(meta.scorecard),
          missing: false
        }));
      } catch (err) {
        drafts.push(Object.assign({}, base, {
          jsonPath: paths[i],
          title: paths[i],
          site: repo.split("/")[1],
          missing: true,
          parseError: true,
          badge: { key: "missing", label: "No score" },
          meta: {}
        }));
      }
    }
    return drafts;
  }

  async function textAt(repo, path, ref) {
    var res = await apiFetch(apiUrl("/repos/" + repo + "/contents/" + lib.encodeRepoPath(path) + "?ref=" + encodeURIComponent(ref)), { raw: true });
    var buf = await res.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf);
  }

  async function refreshInbox() {
    state.loading = true;
    state.error = "";
    if (state.screen === "inbox") renderInbox();
    var warnings = [];
    var groups = await Promise.all(lib.REPOS.map(async function (repo) {
      try {
        var pulls = await apiPaged("/repos/" + repo + "/pulls?state=open&per_page=50&sort=created&direction=desc");
        var reviewPrs = pulls.filter(function (pr) { return lib.hasReviewLabel(pr.labels); });
        var items = [];
        for (var i = 0; i < reviewPrs.length; i++) {
          var drafts = await loadPrDrafts(repo, reviewPrs[i]);
          items = items.concat(drafts);
        }
        return items;
      } catch (err) {
        warnings.push(repo + ": " + err.message);
        return [];
      }
    }));
    state.drafts = lib.sortDrafts([].concat.apply([], groups));
    state.warnings = warnings;
    state.loading = false;
    inboxLoaded = true;
    if (state.screen === "inbox") renderInbox();
  }

  async function ensureDraft(route) {
    var found = state.drafts.find(function (draft) {
      return draft.repo === route.repo && draft.number === route.pr && (!route.json || draft.jsonPath === route.json);
    });
    if (found) return found;
    var pr = await apiJson("/repos/" + route.repo + "/pulls/" + route.pr);
    if (pr.state !== "open" || !lib.hasReviewLabel(pr.labels)) {
      throw new Error("That draft is not an open pull request labeled review.");
    }
    var items = await loadPrDrafts(route.repo, pr);
    var match = items.find(function (draft) { return !route.json || draft.jsonPath === route.json; }) || items[0];
    if (!match) throw new Error("That draft has no review JSON.");
    return match;
  }

  function revokeSession() {
    if (!session) return;
    (session.blobs || []).forEach(function (url) {
      try { URL.revokeObjectURL(url); } catch (err) { /* already gone */ }
    });
    session = null;
  }

  async function blobFor(sess, path) {
    if (sess.fetchCount > 80) throw new Error("Too many files to preview");
    var key = sess.draft.headRepo + "@" + sess.draft.sha + ":" + path;
    if (sess.assetCache.has(key)) return sess.assetCache.get(key);
    sess.fetchCount += 1;
    var res = await apiFetch(apiUrl("/repos/" + sess.draft.headRepo + "/contents/" + lib.encodeRepoPath(path) + "?ref=" + encodeURIComponent(sess.draft.sha)), { raw: true });
    var buf = await res.arrayBuffer();
    var url = URL.createObjectURL(new Blob([buf], { type: lib.mimeFor(path) }));
    sess.blobs.push(url);
    sess.assetCache.set(key, url);
    return url;
  }

  async function fileText(sess, path) {
    var key = "text:" + sess.draft.headRepo + "@" + sess.draft.sha + ":" + path;
    if (sess.assetCache.has(key)) return sess.assetCache.get(key);
    var text = await textAt(sess.draft.headRepo, path, sess.draft.sha);
    sess.assetCache.set(key, text);
    return text;
  }

  async function rewriteCssUrls(sess, css, cssPath) {
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    var matches = [];
    var found;
    while ((found = re.exec(css))) matches.push(found);
    var out = css;
    for (var i = 0; i < matches.length; i++) {
      var raw = matches[i][2].trim();
      if (lib.isExternalUrl(raw)) continue;
      var resolved = lib.resolveRepoPath(cssPath, raw);
      if (!resolved) continue;
      try {
        var blobUrl = await blobFor(sess, resolved);
        out = out.split(matches[i][0]).join('url("' + blobUrl + '")');
      } catch (err) {
        sess.warnings.push("Could not load " + resolved);
      }
    }
    return out;
  }

  async function expandImports(sess, css, cssPath, depth) {
    if (depth > 4) return css;
    var re = /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?[^;]*;/gi;
    var matches = [];
    var found;
    while ((found = re.exec(css))) matches.push(found);
    var out = css;
    for (var i = 0; i < matches.length; i++) {
      var raw = matches[i][2].trim();
      if (lib.isExternalUrl(raw)) continue;
      var resolved = lib.resolveRepoPath(cssPath, raw);
      if (!resolved) continue;
      try {
        var imported = await fileText(sess, resolved);
        imported = await expandImports(sess, imported, resolved, depth + 1);
        imported = await rewriteCssUrls(sess, imported, resolved);
        out = out.split(matches[i][0]).join(imported);
      } catch (err) {
        sess.warnings.push("Could not load " + resolved);
      }
    }
    return out;
  }

  async function rewriteSrcset(sess, value, fromFile) {
    var parts = String(value || "").split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var bit = parts[i].trim();
      if (!bit) continue;
      var pieces = bit.split(/\s+/);
      if (!lib.isExternalUrl(pieces[0])) {
        var resolved = lib.resolveRepoPath(fromFile, pieces[0]);
        if (resolved) {
          try { pieces[0] = await blobFor(sess, resolved); }
          catch (err) { sess.warnings.push("Could not load " + resolved); }
        }
      }
      out.push(pieces.join(" "));
    }
    return out.join(", ");
  }

  async function heroSrc(sess, filePath, hero) {
    if (lib.isExternalUrl(hero)) return hero;
    var attempts = [];
    if (hero.charAt(0) === "/") attempts.push(hero.replace(/^\/+/, ""));
    else {
      attempts.push(hero);
      var rel = lib.resolveRepoPath(filePath, hero);
      if (rel && attempts.indexOf(rel) === -1) attempts.push(rel);
    }
    var last = null;
    for (var i = 0; i < attempts.length; i++) {
      try { return await blobFor(sess, attempts[i]); }
      catch (err) { last = err; }
    }
    throw last || new Error("Could not load " + hero);
  }

  function stripActive(doc) {
    doc.querySelectorAll("script, base, meta[http-equiv]").forEach(function (node) { node.remove(); });
    doc.querySelectorAll("*").forEach(function (node) {
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        if (attr.name.toLowerCase().indexOf("on") === 0) node.removeAttribute(attr.name);
      });
    });
  }

  async function composePreview(sess, filePath, html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    lib.markEditable(doc);
    var preview = new DOMParser().parseFromString(lib.serializeDocument(doc), "text/html");
    stripActive(preview);
    var cssChunks = [];
    var links = Array.prototype.slice.call(preview.querySelectorAll("link"));
    for (var i = 0; i < links.length; i++) {
      var rel = (links[i].getAttribute("rel") || "").toLowerCase();
      if (rel.split(/\s+/).indexOf("stylesheet") === -1) continue;
      var href = links[i].getAttribute("href") || "";
      if (lib.isExternalUrl(href)) continue;
      var cssPath = lib.resolveRepoPath(filePath, href);
      links[i].remove();
      if (!cssPath) continue;
      try {
        var css = await fileText(sess, cssPath);
        css = await expandImports(sess, css, cssPath, 0);
        css = await rewriteCssUrls(sess, css, cssPath);
        var media = links[i].getAttribute("media");
        if (media && media !== "all") css = "@media " + media + " {" + css + "}";
        cssChunks.push(css);
      } catch (err) {
        sess.warnings.push("Could not load " + cssPath);
      }
    }
    var images = Array.prototype.slice.call(preview.querySelectorAll("img[src], source[src], video[poster]"));
    for (var j = 0; j < images.length; j++) {
      var attr = images[j].hasAttribute("poster") && images[j].tagName === "VIDEO" ? "poster" : "src";
      var src = images[j].getAttribute(attr) || "";
      if (!src || lib.isExternalUrl(src)) continue;
      var assetPath = lib.resolveRepoPath(filePath, src);
      if (!assetPath) continue;
      try { images[j].setAttribute(attr, await blobFor(sess, assetPath)); }
      catch (err) { sess.warnings.push("Could not load " + assetPath); }
    }
    var srcsets = Array.prototype.slice.call(preview.querySelectorAll("[srcset]"));
    for (var s = 0; s < srcsets.length; s++) {
      srcsets[s].setAttribute("srcset", await rewriteSrcset(sess, srcsets[s].getAttribute("srcset"), filePath));
    }
    var root = lib.articleRoot(preview);
    var hero = sess.draft.meta && sess.draft.meta.hero_image;
    if (hero && !lib.heroPresent(doc, hero)) {
      try {
        var figure = preview.createElement("figure");
        figure.setAttribute("data-rm-hero", "1");
        var img = preview.createElement("img");
        img.alt = "";
        img.src = await heroSrc(sess, filePath, hero);
        figure.appendChild(img);
        root.insertBefore(figure, root.firstChild);
      } catch (err) {
        sess.warnings.push("Could not load the hero image");
      }
    }
    var meta = preview.createElement("div");
    meta.setAttribute("data-rm-meta", "1");
    meta.setAttribute("contenteditable", "true");
    meta.setAttribute("role", "textbox");
    meta.setAttribute("aria-label", "Meta description");
    meta.setAttribute("spellcheck", "true");
    meta.textContent = (sess.draft.meta && sess.draft.meta.meta_description) || "";
    root.insertBefore(meta, root.firstChild);
    preview.querySelectorAll("[data-rm-edit]").forEach(function (node) {
      node.setAttribute("contenteditable", "true");
      node.setAttribute("spellcheck", "true");
    });
    var style = preview.createElement("style");
    style.setAttribute("data-rm-preview", "1");
    style.textContent = cssChunks.join("\n") + "\n" + PREVIEW_CSS;
    preview.head.appendChild(style);
    return lib.serializeDocument(preview);
  }

  function baselineFrom(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var h1 = lib.articleRoot(doc).querySelector("h1");
    var meta = doc.querySelector('meta[name="description"]');
    return {
      h1: h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "",
      description: meta ? String(meta.getAttribute("content") || "").replace(/\s+/g, " ").trim() : ""
    };
  }

  function takeSnap(doc) {
    var html = {};
    doc.querySelectorAll("[data-rm-edit]").forEach(function (node) {
      html[node.getAttribute("data-rm-edit")] = node.innerHTML;
    });
    var meta = doc.querySelector("[data-rm-meta]");
    var h1 = doc.querySelector("h1[data-rm-edit]");
    return {
      html: html,
      description: meta ? meta.textContent.replace(/\s+/g, " ").trim() : "",
      h1: h1 ? h1.textContent.replace(/\s+/g, " ").trim() : ""
    };
  }

  function insertBreak(doc) {
    var sel = doc.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var br = doc.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function bindPreview(iframe) {
    var doc = iframe.contentDocument;
    if (!doc) return;
    session.snap = takeSnap(doc);
    var mark = function () {
      state.dirty = true;
      var save = document.getElementById("save-edits");
      if (save) save.classList.add("dirty");
      var titleNode = document.getElementById("review-title");
      var h1 = doc.querySelector("h1[data-rm-edit]");
      if (titleNode && h1) titleNode.textContent = h1.textContent.replace(/\s+/g, " ").trim() || "Untitled draft";
      fitIframe(iframe);
    };
    doc.querySelectorAll("[data-rm-edit], [data-rm-meta]").forEach(function (node) {
      node.addEventListener("input", mark);
      node.addEventListener("paste", function (event) {
        event.preventDefault();
        var text = (event.clipboardData && event.clipboardData.getData("text/plain")) || "";
        var sel = doc.getSelection();
        if (!sel || !sel.rangeCount) return;
        var range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(doc.createTextNode(text));
        range.collapse(false);
        mark();
      });
      node.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && node.tagName !== "PRE") {
          event.preventDefault();
          insertBreak(doc);
          mark();
        }
      });
    });
    doc.addEventListener("click", function (event) {
      var anchor = event.target && event.target.closest && event.target.closest("a");
      if (anchor) event.preventDefault();
    });
    Array.prototype.forEach.call(doc.images || [], function (img) {
      img.addEventListener("load", function () { fitIframe(iframe); });
    });
    fitIframe(iframe);
    window.setTimeout(function () { fitIframe(iframe); }, 250);
  }

  function fitIframe(iframe) {
    var doc = iframe.contentDocument;
    if (!doc) return;
    var height = Math.max(
      doc.documentElement ? doc.documentElement.scrollHeight : 0,
      doc.body ? doc.body.scrollHeight : 0
    );
    iframe.style.height = Math.max(520, height + 24) + "px";
  }

  function currentEdits() {
    var iframe = document.getElementById("preview");
    var doc = iframe && iframe.contentDocument;
    if (!doc || !session || !session.snap) return null;
    var edits = {};
    doc.querySelectorAll("[data-rm-edit]").forEach(function (node) {
      var id = node.getAttribute("data-rm-edit");
      if (node.innerHTML !== session.snap.html[id]) edits[id] = node.innerHTML;
    });
    var meta = doc.querySelector("[data-rm-meta]");
    var h1 = doc.querySelector("h1[data-rm-edit]");
    return {
      edits: edits,
      description: meta ? meta.textContent.replace(/\s+/g, " ").trim() : session.snap.description,
      h1: h1 ? h1.textContent.replace(/\s+/g, " ").trim() : session.snap.h1
    };
  }

  async function saveEdits(opts) {
    opts = opts || {};
    if (!opts.holdLock) {
      if (lock) return false;
      lock = true;
    }
    var draft = state.draft;
    var change = currentEdits();
    if (!draft || !session || !change) {
      if (!opts.holdLock) lock = false;
      return false;
    }
    var file = session.files[session.activePath];
    if (!file) {
      if (!opts.holdLock) lock = false;
      return false;
    }
    var h1Changed = change.h1 !== session.snap.h1;
    var descChanged = change.description !== session.snap.description;
    var textChanged = Object.keys(change.edits).length > 0;
    if (!h1Changed && !descChanged && !textChanged) {
      state.dirty = false;
      if (!opts.quiet) {
        state.notice = "No changes to save.";
        paintStatus();
      }
      if (!opts.holdLock) lock = false;
      return false;
    }
    state.busy = "Saving…";
    paintStatus();
    var updates = {};
    if (h1Changed) {
      updates.title = change.h1;
      updates.originalH1 = file.baseline.h1 || session.snap.h1;
    }
    if (descChanged) updates.description = change.description;
    var nextHtml = lib.applyEdits(file.originalHtml, change.edits, updates);
    var files = [{ path: session.activePath, content: nextHtml }];
    var nextTitle = h1Changed ? change.h1 : (draft.meta.title || draft.title);
    var nextDesc = descChanged ? change.description : (draft.meta.meta_description || "");
    if ((h1Changed || descChanged) && draft.jsonPath) {
      files.push({
        path: draft.jsonPath,
        content: lib.withReviewMeta(draft.jsonText, nextTitle, nextDesc)
      });
    }
    try {
      var sha = await commitFiles(draft.headRepo, draft.branch, files);
      file.originalHtml = nextHtml;
      file.baseline = baselineFrom(nextHtml);
      draft.sha = sha;
      draft.jsonText = files.length > 1 ? files[1].content : draft.jsonText;
      draft.meta.title = nextTitle;
      draft.meta.meta_description = nextDesc;
      draft.title = nextTitle;
      session.snap = takeSnap(document.getElementById("preview").contentDocument);
      state.dirty = false;
      if (!opts.quiet) state.notice = "Saved.";
      state.error = "";
      var save = document.getElementById("save-edits");
      if (save) save.classList.remove("dirty");
      return true;
    } catch (err) {
      state.error = err.message;
      state.notice = "";
      throw err;
    } finally {
      if (!opts.holdLock) {
        lock = false;
        state.busy = "";
        paintStatus();
      }
    }
  }

  async function commitFiles(repo, branch, files) {
    var refPath = branch.split("/").map(encodeURIComponent).join("/");
    var refData = await apiJson("/repos/" + repo + "/git/ref/heads/" + refPath);
    var parentSha = refData.object.sha;
    var parent = await apiJson("/repos/" + repo + "/git/commits/" + parentSha);
    var tree = [];
    for (var i = 0; i < files.length; i++) {
      var blob = await apiJson("/repos/" + repo + "/git/blobs", {
        method: "POST",
        body: { content: files[i].content, encoding: "utf-8" }
      });
      tree.push({ path: files[i].path, mode: "100644", type: "blob", sha: blob.sha });
    }
    var treeData = await apiJson("/repos/" + repo + "/git/trees", {
      method: "POST",
      body: { base_tree: parent.tree.sha, tree: tree }
    });
    var commit = await apiJson("/repos/" + repo + "/git/commits", {
      method: "POST",
      body: { message: "Ryan edits", tree: treeData.sha, parents: [parentSha] }
    });
    await apiJson("/repos/" + repo + "/git/refs/heads/" + refPath, {
      method: "PATCH",
      body: { sha: commit.sha }
    });
    return commit.sha;
  }

  async function publish() {
    if (state.busy || !state.draft) return;
    var draft = state.draft;
    var url = lib.liveUrl(draft.meta.site || draft.site, draft.meta.url_path || "/");
    var ok = await openModal(function (card, close) {
      card.append(
        el("h2", {}, "Publish this draft?"),
        el("p", {}, "This saves your edits, squash-merges the pull request, and publishes the page."),
        el("p", {}, ["Live URL: ", el("span", { class: "live-url" }, url)]),
        el("div", { class: "modal-actions" }, [
          el("button", { class: "btn ghost", type: "button", id: "modal-cancel" }, "Cancel"),
          el("button", { class: "btn primary", type: "button", id: "modal-ok" }, "Publish")
        ])
      );
      card.querySelector("#modal-cancel").addEventListener("click", function () { close(false); });
      card.querySelector("#modal-ok").addEventListener("click", function () { close(true); });
      card.querySelector("#modal-cancel").focus();
    });
    if (!ok || lock) return;
    var committed = false;
    lock = true;
    state.busy = "Publishing…";
    state.error = "";
    paintStatus();
    try {
      committed = await saveEdits({ holdLock: true, quiet: true });
      state.busy = "Publishing…";
      paintStatus();
      await apiJson("/repos/" + draft.repo + "/pulls/" + draft.number + "/merge", {
        method: "PUT",
        body: { merge_method: "squash" }
      });
      state.dirty = false;
      state.busy = "";
      showPublished(url);
    } catch (err) {
      state.busy = "";
      state.error = (committed ? "Edits are saved on the branch. " : "") + "Publish did not finish. " + err.message;
      paintStatus();
    } finally {
      lock = false;
      state.busy = "";
    }
  }

  function showPublished(url) {
    state.notice = "";
    state.error = "";
    var bar = document.querySelector(".action-bar");
    if (bar) {
      clear(bar);
      bar.append(
        el("a", { class: "btn primary", href: url, target: "_blank", rel: "noopener noreferrer" }, "Open live page"),
        el("button", { class: "btn ghost", type: "button" }, "Back to drafts")
      );
      bar.querySelector("button").addEventListener("click", goInbox);
    }
    var host = document.querySelector(".review-screen") || app;
    var oldBanner = host.querySelector(".banner");
    if (oldBanner) oldBanner.remove();
    var banner = el("div", { class: "banner ok", role: "status" });
    banner.append(
      document.createTextNode("Published. The live page may take a minute to update. "),
      el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, url)
    );
    host.insertBefore(banner, host.children[1] || null);
  }

  async function sendBack() {
    if (state.busy || !state.draft) return;
    var note = await openModal(function (card, close) {
      var extra = state.dirty ? "Unsaved edits are committed to the branch first." : "The pull request stays open with the review label.";
      card.append(
        el("h2", {}, "Send back"),
        el("p", {}, extra),
        el("label", { class: "field-label", for: "send-note" }, "Note for the author"),
        el("textarea", { id: "send-note", placeholder: "What should change?" }),
        el("div", { class: "modal-actions" }, [
          el("button", { class: "btn ghost", type: "button", id: "modal-cancel" }, "Cancel"),
          el("button", { class: "btn primary", type: "button", id: "modal-ok" }, "Send back")
        ])
      );
      var area = card.querySelector("#send-note");
      card.querySelector("#modal-cancel").addEventListener("click", function () { close(null); });
      card.querySelector("#modal-ok").addEventListener("click", function () { close(area.value.trim()); });
      area.focus();
    });
    if (note == null) return;
    if (!note) {
      state.error = "Write a note before sending the draft back.";
      paintStatus();
      return;
    }
    if (lock) return;
    var committed = false;
    lock = true;
    state.busy = "Sending…";
    state.error = "";
    paintStatus();
    try {
      if (state.dirty) {
        committed = await saveEdits({ holdLock: true, quiet: true });
        state.busy = "Sending…";
        paintStatus();
      }
      await postNote(state.draft.repo, state.draft.number, note);
      try {
        await addLabel(state.draft.repo, state.draft.number, "changes-requested");
      } catch (labelErr) {
        throw new Error("The note was posted. The changes-requested label was not added. " + labelErr.message);
      }
      state.draft.changesRequested = true;
      state.notice = "Sent back. The note is on the pull request.";
      state.error = "";
    } catch (err) {
      var hint = err.status === 403 ? " The token needs Pull requests set to Read and write." : "";
      state.error = (committed ? "Edits are saved on the branch. " : "") + err.message + hint;
      state.notice = "";
    } finally {
      lock = false;
      state.busy = "";
      paintStatus();
    }
  }

  async function postNote(repo, number, note) {
    try {
      await apiJson("/repos/" + repo + "/issues/" + number + "/comments", {
        method: "POST",
        body: { body: note }
      });
    } catch (err) {
      if (err.status !== 403 && err.status !== 404) throw err;
      await apiJson("/repos/" + repo + "/pulls/" + number + "/reviews", {
        method: "POST",
        body: { body: note, event: "COMMENT" }
      });
    }
  }

  async function addLabel(repo, number, name) {
    try {
      await apiJson("/repos/" + repo + "/issues/" + number + "/labels", {
        method: "POST",
        body: { labels: [name] }
      });
    } catch (err) {
      var missing = err.status === 404 || /label does not exist/i.test(err.message || "");
      if (!missing) throw err;
      await apiJson("/repos/" + repo + "/labels", {
        method: "POST",
        body: {
          name: name,
          color: "D93F0B",
          description: "Ryan sent this draft back from the article editor"
        }
      });
      await apiJson("/repos/" + repo + "/issues/" + number + "/labels", {
        method: "POST",
        body: { labels: [name] }
      });
    }
  }

  function openModal(build) {
    return new Promise(function (resolve) {
      var root = el("div", { class: "modal", role: "dialog", "aria-modal": "true" });
      var card = el("div", { class: "modal-card" });
      root.append(card);
      var settled = false;
      function close(value) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey);
        root.remove();
        resolve(value);
      }
      function onKey(event) {
        if (event.key === "Escape") close(null);
      }
      document.addEventListener("keydown", onKey);
      root.addEventListener("click", function (event) {
        if (event.target === root) close(null);
      });
      build(card, close);
      document.body.append(root);
    });
  }

  function paintStatus() {
    var host = document.querySelector(".review-screen") || document.querySelector(".shell");
    if (!host) return;
    if (state.error) setBanner(host, state.error, "err");
    else if (state.notice) setBanner(host, state.busy || state.notice, "ok");
    else if (state.busy) setBanner(host, state.busy, "ok");
    else setBanner(host, "", "ok");
    var save = document.getElementById("save-edits");
    var publish = document.getElementById("publish");
    var send = document.getElementById("send-back");
    [save, publish, send].forEach(function (button) {
      if (button) button.disabled = !!state.busy;
    });
  }

  function goInbox() {
    if (state.dirty && !window.confirm("You have unsaved edits. Leave this draft?")) return;
    state.dirty = false;
    state.error = "";
    state.notice = "";
    location.hash = "#/";
  }

  function signOut() {
    if (state.dirty && !window.confirm("You have unsaved edits. Sign out?")) return;
    token = "";
    state.dirty = false;
    state.drafts = [];
    inboxLoaded = false;
    clearStoredToken();
    revokeSession();
    location.hash = "#/";
    renderSignin("");
  }

  function header(title) {
    return el("header", { class: "top" }, [
      el("a", { class: "mark", href: "/", "aria-label": "RM logo" }, el("span", { class: "mark-letters" }, "RM")),
      el("p", { class: "top-title", id: "review-title" }, title || "Article editor"),
      el("button", { class: "text-btn", type: "button" }, "Sign out")
    ]);
  }

  function renderSignin(message) {
    state.screen = "signin";
    document.body.classList.remove("reviewing");
    revokeSession();
    clear(app);
    var form = el("form", { class: "token-form", autocomplete: "off" });
    var input = el("input", {
      id: "token",
      type: "password",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      placeholder: "github_pat_…",
      "aria-label": "GitHub token"
    });
    var show = el("button", { class: "show-token", type: "button" }, "Show");
    show.addEventListener("click", function () {
      var hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      show.textContent = hidden ? "Hide" : "Show";
    });
    form.append(
      el("label", { class: "field-label", for: "token" }, "GitHub token"),
      el("div", { class: "token-row" }, [input, show]),
      el("button", { class: "btn primary wide", type: "submit" }, "Continue")
    );
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var next = lib.cleanToken(input.value);
      input.value = "";
      if (!next) {
        state.error = "Paste a token first.";
        setBanner(shell, state.error, "err");
        return;
      }
      token = next;
      state.error = "";
      setBanner(shell, "Checking the token…", "ok");
      try {
        await assertToken();
        writeStoredToken(next);
        show();
      } catch (err) {
        token = "";
        setBanner(shell, err.message, "err");
      }
    });
    var repos = el("ul");
    lib.REPOS.forEach(function (repo) { repos.append(el("li", {}, repo)); });
    var help = el("details", { class: "help" }, [
      el("summary", {}, "How to get a token"),
      el("p", {}, "Create a fine-grained personal access token. It is saved only in this browser and is sent only to api.github.com."),
      el("ol", {}, [
        el("li", {}, [
          "Open ",
          el("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener noreferrer" }, "github.com/settings/personal-access-tokens/new"),
          "."
        ]),
        el("li", {}, ["Token name: ", el("code", {}, "Article editor"), "."]),
        el("li", {}, ["Resource owner: ", el("code", {}, "ryanmoalemi"), "."]),
        el("li", {}, "Expiration: 90 days, or another date you prefer."),
        el("li", {}, ["Repository access: Only select repositories. Select these five:", repos]),
        el("li", {}, [
          "Repository permissions: set ",
          el("strong", {}, "Contents"),
          " to Read and write, and ",
          el("strong", {}, "Pull requests"),
          " to Read and write. Leave Metadata on its required Read-only access. Do not add account permissions."
        ]),
        el("li", {}, "Click Generate token."),
        el("li", {}, "Copy the token. It starts with github_pat_. GitHub shows it only once. Paste it above.")
      ])
    ]);
    var shell = el("main", { class: "shell signin" }, [
      header("Article editor"),
      el("p", { class: "eyebrow" }, "Private"),
      el("h1", { class: "display" }, "Article editor"),
      el("p", { class: "lede" }, "Review draft articles here instead of Google Docs. Open pull requests labeled review show up as an inbox."),
      form,
      el("p", { class: "fine" }, "The token stays in localStorage on this device. Requests go only to api.github.com."),
      help
    ]);
    if (message) shell.insertBefore(el("div", { class: "banner", role: "alert" }, message), shell.children[1]);
    app.append(shell);
    var signOutBtn = shell.querySelector(".text-btn");
    if (signOutBtn) signOutBtn.remove();
  }

  function renderInbox() {
    state.screen = "inbox";
    document.body.classList.remove("reviewing");
    revokeSession();
    clear(app);
    var list = el("ul", { class: "draft-list" });
    if (state.loading && !state.drafts.length) {
      list.append(el("li", { class: "empty-card" }, el("p", {}, "Loading drafts…")));
    } else if (!state.drafts.length) {
      list.append(el("li", { class: "empty-card" }, [
        el("h2", {}, "No open drafts"),
        el("p", {}, "When an agent opens a pull request labeled review, it shows up here.")
      ]));
    } else {
      state.drafts.forEach(function (draft) {
        var bits = draft.missing ? null : scoreBits(draft.meta);
        var blurb = lib.firstSentence(lib.articleSummary(draft.meta));
        var button = el("button", { class: "draft-card", type: "button" }, [
          el("div", { class: "card-top" }, el("p", { class: "card-site" }, draft.site || draft.repo)),
          el("h2", {}, draft.title || "Untitled draft"),
          blurb ? el("p", { class: "card-summary" }, blurb) : null,
          el("div", { class: "card-score" }, bits ? [
            starsNode(bits.stars),
            el("span", { class: "overall" }, bits.text),
            badgeNode(bits.badge)
          ] : [
            badgeNode(draft.badge || { key: "missing", label: "No score" })
          ]),
          el("p", { class: "card-meta" }, [
            lib.ageLabel(draft.createdAt),
            " · ",
            draft.repo,
            " · #",
            String(draft.number),
            draft.changesRequested ? el("span", { class: "chip" }, "Changes requested") : ""
          ])
        ]);
        button.addEventListener("click", function () {
          if (draft.missing) {
            state.error = draft.parseError ? "The review JSON could not be read." : "This pull request has no review/<slug>.json file.";
            renderInbox();
            return;
          }
          location.hash = reviewHash(draft);
        });
        list.append(el("li", {}, button));
      });
    }
    var head = header("Drafts");
    head.querySelector(".text-btn").addEventListener("click", signOut);
    var shell = el("main", { class: "shell" }, [
      head,
      el("div", { class: "section-head" }, [
        el("div", {}, [
          el("p", { class: "eyebrow" }, "Inbox"),
          el("h1", {}, "Drafts")
        ]),
        el("button", { class: "btn ghost", type: "button", id: "refresh" }, state.loading ? "Refreshing…" : "Refresh")
      ]),
      list
    ]);
    if (state.warnings.length) {
      shell.append(el("ul", { class: "warnings" }, state.warnings.map(function (item) {
        return el("li", {}, item);
      })));
    }
    app.append(shell);
    if (state.error) setBanner(shell, state.error, "err");
    shell.querySelector("#refresh").addEventListener("click", function () {
      refreshInbox().catch(function (err) {
        state.loading = false;
        state.error = err.message;
        renderInbox();
      });
    });
    if (!inboxLoaded && !state.loading) {
      refreshInbox().catch(function (err) {
        state.loading = false;
        state.error = err.message;
        renderInbox();
      });
    }
  }

  function scorecard(draft) {
    var meta = draft.meta || {};
    var sc = meta.scorecard || {};
    var bits = scoreBits(meta);
    var badge = bits ? bits.badge : lib.badgeFor(sc);
    var cats = Array.isArray(sc.categories) ? sc.categories : [];
    var points = lib.uniquePoints(meta);
    var info = textOf(sc.info_gain);
    var flags = lib.aiFlags(sc);
    var summary = lib.articleSummary(meta);
    var uniqueBox = el("section", { class: "callout" + (points.length ? "" : " warn") }, [
      el("h3", {}, "Information gain: what makes this unique and hard to copy"),
      points.length
        ? el("ul", { class: "point-list" }, points.map(function (item) { return el("li", {}, item); }))
        : el("p", { class: "warn-unique" }, "Nothing unique yet"),
      info ? el("p", { class: "info-copy" }, info) : null
    ]);
    var voiceBox = el("section", { class: "callout" }, [
      el("h3", {}, "Human voice"),
      flags.length
        ? el("ul", { class: "point-list" }, flags.map(function (item) { return el("li", {}, item); }))
        : el("p", { class: "info-copy" }, "No lines flagged.")
    ]);
    var blocks = [
      el("div", { class: "score-head" }, [
        el("p", { class: "score-total" }, bits ? bits.text : "Overall n/a"),
        bits ? starsNode(bits.stars) : null,
        badgeNode(badge)
      ]),
      el("div", { class: "gain-row" }, [uniqueBox, voiceBox]),
      el("section", { class: "callout summary-box" }, [
        el("h3", {}, "Summary"),
        el("p", { class: summary ? "info-copy" : "info-copy" }, summary || "No summary yet.")
      ])
    ];
    cats.forEach(function (cat) {
      var score = Number(cat && cat.score);
      var max = Number(cat && cat.max);
      if (!Number.isFinite(max) || max <= 0) max = 10;
      if (!Number.isFinite(score)) score = 0;
      var whole = Math.round(score);
      var stars = lib.starCount(whole, max);
      blocks.push(el("div", { class: "cat" }, [
        el("div", { class: "cat-top" }, [
          el("strong", {}, (cat && cat.name) || "Category"),
          el("span", { class: "cat-score" }, whole + "/" + max)
        ]),
        starsNode(stars),
        cat && cat.reason ? el("p", { class: "reason" }, cat.reason) : null
      ]));
    });
    var unverified = lib.unverifiedList(meta);
    if (unverified.length) {
      blocks.push(el("div", { class: "score-block" }, [
        el("h3", {}, "Unverified"),
        el("ul", { class: "unverified" }, unverified.map(function (item) { return el("li", {}, item); }))
      ]));
    }
    blocks.push(el("p", { class: "pr-link" }, el("a", {
      href: draft.htmlUrl,
      target: "_blank",
      rel: "noopener noreferrer"
    }, draft.repo + " #" + draft.number)));
    return el("aside", { class: "dashboard", id: "scorecard", "aria-label": "Scorecard" }, [
      el("p", { class: "eyebrow" }, "Scorecard"),
      el("div", { class: "score-body" }, blocks)
    ]);
  }

  async function renderReview(route) {
    state.screen = "review";
    document.body.classList.add("reviewing");
    if (session && state.draft && state.draft.repo === route.repo && state.draft.number === route.pr && state.reviewHash === location.hash) {
      return;
    }
    revokeSession();
    clear(app);
    var head = header("Loading draft…");
    head.querySelector(".text-btn").addEventListener("click", signOut);
    var back = el("button", { class: "nav-btn", type: "button" }, "Drafts");
    back.addEventListener("click", goInbox);
    head.insertBefore(back, head.children[1]);
    var bar = el("div", { class: "action-bar" }, [
      el("button", { class: "btn ghost", type: "button", id: "save-edits" }, "Save edits"),
      el("button", { class: "btn ghost", type: "button", id: "send-back" }, "Send back"),
      el("button", { class: "btn primary", type: "button", id: "publish" }, "Approve & publish")
    ]);
    var frame = el("iframe", {
      class: "preview",
      id: "preview",
      sandbox: "allow-same-origin",
      referrerpolicy: "no-referrer",
      title: "Article preview"
    });
    var screen = el("main", { class: "review-screen" }, [
      head,
      bar,
      el("p", { class: "muted" }, "Loading the article…")
    ]);
    app.append(screen);
    bar.querySelector("#save-edits").addEventListener("click", function () {
      saveEdits().catch(function (err) {
        state.error = err.message;
        paintStatus();
      });
    });
    bar.querySelector("#send-back").addEventListener("click", function () { sendBack(); });
    bar.querySelector("#publish").addEventListener("click", function () { publish(); });
    try {
      var draft = await ensureDraft(route);
      if (state.screen !== "review") return;
      state.draft = draft;
      state.reviewHash = reviewHash(draft);
      document.getElementById("review-title").textContent = draft.title || "Untitled draft";
      var files = lib.htmlFiles(draft.meta.files || []);
      if (!files.length) throw new Error("The review JSON does not list an article HTML file.");
      var active = lib.pickPrimaryFile(files, draft.meta.url_path);
      session = {
        draft: draft,
        activePath: active,
        files: {},
        warnings: [],
        blobs: [],
        assetCache: new Map(),
        fetchCount: 0,
        snap: null
      };
      var html = await textAt(draft.headRepo, active, draft.sha);
      session.files[active] = { originalHtml: html, baseline: baselineFrom(html) };
      var srcdoc = await composePreview(session, active, html);
      if (state.screen !== "review") return;
      var grid = el("div", { class: "review-grid" }, [
        scorecard(draft),
        el("div", { class: "preview-wrap" }, fileSwitcher(files, active).concat([frame]))
      ]);
      var note = screen.querySelector(".muted");
      if (note) note.remove();
      screen.append(grid);
      if (session.warnings.length) {
        screen.append(el("ul", { class: "warnings" }, session.warnings.map(function (item) {
          return el("li", {}, item);
        })));
      }
      frame.addEventListener("load", function () {
        if (!frame.contentDocument || !frame.contentDocument.body) {
          state.error = "The preview could not be opened for editing.";
          paintStatus();
          return;
        }
        bindPreview(frame);
      });
      frame.srcdoc = srcdoc;
    } catch (err) {
      state.error = err.message;
      paintStatus();
    }
  }

  function fileSwitcher(files, active) {
    if (files.length < 2) return [];
    var row = el("div", { class: "file-switch" });
    files.forEach(function (path) {
      var button = el("button", { type: "button", "aria-pressed": path === active ? "true" : "false" }, path.split("/").pop());
      button.addEventListener("click", function () { switchFile(path); });
      row.append(button);
    });
    return [row];
  }

  async function switchFile(path) {
    if (!session || session.activePath === path || state.busy) return;
    state.notice = "Open one article file at a time. Save before switching if you changed this page.";
    if (state.dirty && !window.confirm("Save is still pending. Switch files without saving this page?")) return;
    state.busy = "Loading…";
    paintStatus();
    try {
      var html = session.files[path] ? session.files[path].originalHtml : await textAt(session.draft.headRepo, path, session.draft.sha);
      session.files[path] = session.files[path] || { originalHtml: html, baseline: baselineFrom(html) };
      session.activePath = path;
      session.warnings = [];
      var srcdoc = await composePreview(session, path, session.files[path].originalHtml);
      var frame = document.getElementById("preview");
      frame.srcdoc = srcdoc;
      state.dirty = false;
      state.notice = "";
      document.querySelectorAll(".file-switch button").forEach(function (button) {
        button.setAttribute("aria-pressed", button.textContent === path.split("/").pop() ? "true" : "false");
      });
    } catch (err) {
      state.error = err.message;
    } finally {
      state.busy = "";
      paintStatus();
    }
  }

  function show() {
    if (!token) {
      renderSignin(state.error);
      return;
    }
    var route = parseRoute();
    if (route.name === "review" && route.repo && route.pr) renderReview(route);
    else renderInbox();
  }

  window.addEventListener("hashchange", function () {
    if (ignoreHash) {
      ignoreHash = false;
      return;
    }
    if (state.dirty) {
      var ok = window.confirm("You have unsaved edits. Leave this draft?");
      if (!ok) {
        ignoreHash = true;
        location.hash = state.reviewHash || "#/";
        return;
      }
      state.dirty = false;
    }
    show();
  });

  window.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && state.screen === "review") {
      event.preventDefault();
      saveEdits().catch(function (err) {
        state.error = err.message;
        paintStatus();
      });
    }
  });

  window.addEventListener("beforeunload", function (event) {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  async function boot() {
    var stored = readStoredToken();
    if (!stored) {
      renderSignin("");
      return;
    }
    token = stored;
    renderSignin("");
    setBanner(app.querySelector(".shell"), "Checking the saved token…", "ok");
    try {
      await assertToken();
      show();
    } catch (err) {
      token = "";
      clearStoredToken();
      renderSignin(err.message);
    }
  }

  boot();
})();
