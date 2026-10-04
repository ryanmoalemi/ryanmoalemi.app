(function (root) {
  var REPOS = [
    "ryanmoalemi/fullcourtbuckets",
    "ryanmoalemi/sandiegoadubuilder.com",
    "ryanmoalemi/ryanmoalemi.com",
    "ryanmoalemi/ryanmoalemi.app",
    "ryanmoalemi/ryanmoalemi.github.io"
  ];

  var TOKEN_KEY = "rm-editor-token";
  var TEXT_BLOCKS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "figcaption", "blockquote", "td", "th", "dt", "dd", "caption", "pre", "address", "summary"];

  function isGitHubApiUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "api.github.com";
    } catch (err) {
      return false;
    }
  }

  function cleanToken(value) {
    return String(value || "").trim().replace(/^Bearer\s+/i, "").replace(/\s+/g, "");
  }

  function encodeRepoPath(path) {
    return String(path || "").split("/").map(function (part) {
      return encodeURIComponent(part);
    }).join("/");
  }

  function isExternalUrl(url) {
    var value = String(url || "").trim();
    return /^https?:\/\//i.test(value) ||
      value.indexOf("//") === 0 ||
      value.indexOf("data:") === 0 ||
      value.indexOf("blob:") === 0 ||
      value.indexOf("mailto:") === 0 ||
      value.indexOf("#") === 0;
  }

  function stripUrlDecorations(url) {
    var value = String(url || "").trim();
    var hash = value.indexOf("#");
    if (hash !== -1) value = value.slice(0, hash);
    var query = value.indexOf("?");
    if (query !== -1) value = value.slice(0, query);
    return value;
  }

  function resolveRepoPath(fromFile, href) {
    var clean = stripUrlDecorations(href);
    if (!clean || isExternalUrl(clean)) return "";
    if (clean.charAt(0) === "/") return clean.replace(/^\/+/, "");
    var base = String(fromFile || "").split("/").slice(0, -1);
    var parts = clean.split("/");
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i] === ".") continue;
      if (parts[i] === "..") base.pop();
      else base.push(parts[i]);
    }
    return base.join("/");
  }

  function liveUrl(site, urlPath) {
    var path = String(urlPath || "/").trim();
    if (!path) path = "/";
    if (path.charAt(0) !== "/") path = "/" + path;
    var host = String(site || "").trim();
    if (!host) return path;
    if (/^https?:\/\//i.test(host)) return host.replace(/\/+$/, "") + path;
    host = host.replace(/^\/\//, "").replace(/\/+$/, "");
    return "https://" + host + path;
  }

  function scoreMax(scorecard) {
    var max = Number(scorecard && scorecard.max);
    if (Number.isFinite(max) && max > 0) return max;
    return 10;
  }

  function overallScore(scorecard) {
    if (!scorecard || scorecard.overall == null || scorecard.overall === "") return null;
    var n = Number(scorecard.overall);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }

  function formatScore(n) {
    var value = Number(n);
    if (!Number.isFinite(value)) return "";
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(Math.round(value * 10) / 10);
  }

  function pointsScore(scorecard) {
    var overall = overallScore(scorecard);
    if (overall == null) return null;
    return { score: overall, max: scoreMax(scorecard), kind: "overall" };
  }

  function categoryScore(scorecard, name) {
    var cats = scorecard && Array.isArray(scorecard.categories) ? scorecard.categories : [];
    var want = String(name || "").toLowerCase();
    for (var i = 0; i < cats.length; i++) {
      var label = String(cats[i] && cats[i].name || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (label === want) {
        var n = Number(cats[i].score);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  }

  function starCount(score, max) {
    var s = Number(score);
    var m = Number(max);
    if (!Number.isFinite(s)) return null;
    if (!Number.isFinite(m) || m <= 0) m = 10;
    var half = Math.round(((s / m) * 5) * 2) / 2;
    if (half < 0) return 0;
    if (half > 5) return 5;
    return half;
  }

  function starNumber(count) {
    if (count == null || !Number.isFinite(Number(count))) return "";
    var n = Number(count);
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  function starLabel(count) {
    var text = starNumber(count);
    if (!text) return "";
    return text + " out of 5 stars";
  }

  function starPhrase(count) {
    var text = starNumber(count);
    if (!text) return "";
    return text + (Number(count) === 1 ? " star" : " stars");
  }

  function badgeFor(scorecard) {
    var sc = scorecard || {};
    var overall = overallScore(sc);
    if (overall == null) return { key: "needs-work", label: "Needs work" };
    var accuracy = categoryScore(sc, "accuracy");
    var info = categoryScore(sc, "information gain");
    if (info == null) info = categoryScore(sc, "info gain");
    var voice = categoryScore(sc, "human voice");
    if (overall >= 8 && accuracy >= 9 && info >= 6 && voice >= 7) {
      return { key: "ready", label: "Ready" };
    }
    if (overall < 6) return { key: "rework", label: "Rework" };
    return { key: "needs-work", label: "Needs work" };
  }

  function stringList(value) {
    var source = Array.isArray(value) ? value : (typeof value === "string" && value.trim() ? [value] : []);
    return source.map(function (item) {
      if (item == null) return "";
      if (typeof item === "string" || typeof item === "number") return String(item).trim();
      if (typeof item === "object") {
        if (item.text) return String(item.text).trim();
        if (item.summary) return String(item.summary).trim();
        if (item.point) return String(item.point).trim();
      }
      return "";
    }).filter(Boolean);
  }

  function uniquenessBlock(meta) {
    var m = meta || {};
    var block = m.uniqueness;
    var summary = "";
    var points = [];
    if (block && typeof block === "object" && !Array.isArray(block)) {
      if (typeof block.summary === "string") summary = block.summary.trim();
      points = stringList(block.points);
    }
    if (!points.length) points = stringList(m.unique);
    return { summary: summary, points: points };
  }

  function uniquePoints(meta) {
    return uniquenessBlock(meta).points;
  }

  function articleSummary(meta) {
    var m = meta || {};
    if (typeof m.summary === "string" && m.summary.trim()) return m.summary.trim();
    return "";
  }

  function firstSentence(text) {
    var value = String(text || "").replace(/\s+/g, " ").trim();
    if (!value) return "";
    var parts = value.split(/(?<=[.!?])\s+/);
    return parts[0];
  }

  function unverifiedList(meta) {
    var m = meta || {};
    var top = stringList(m.unverified);
    if (top.length) return top;
    return stringList(m.scorecard && m.scorecard.unverified);
  }

  function aiFlags(scorecard) {
    return stringList(scorecard && scorecard.ai_flags);
  }

  function ageLabel(iso, now) {
    var t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    var seconds = Math.max(0, ((now == null ? Date.now() : now) - t) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    var days = Math.floor(seconds / 86400);
    if (days < 14) return days + "d ago";
    try {
      return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (err) {
      return days + "d ago";
    }
  }

  function sortDrafts(list) {
    return (list || []).slice().sort(function (a, b) {
      var delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (delta) return delta;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }

  function hasReviewLabel(labels) {
    return (labels || []).some(function (label) {
      var name = typeof label === "string" ? label : label && label.name;
      return String(name || "").toLowerCase() === "review";
    });
  }

  function hasLabel(labels, expected) {
    var want = String(expected || "").toLowerCase();
    return (labels || []).some(function (label) {
      var name = typeof label === "string" ? label : label && label.name;
      return String(name || "").toLowerCase() === want;
    });
  }

  function reviewJsonPaths(paths) {
    return (paths || []).filter(function (path) {
      return /^review\/[^/]+\.json$/i.test(String(path || ""));
    });
  }

  function htmlFiles(files) {
    return (files || []).filter(function (path) {
      return /\.html?$/i.test(String(path || ""));
    });
  }

  function pickPrimaryFile(files, urlPath) {
    var list = htmlFiles(files);
    if (!list.length) list = (files || []).filter(Boolean);
    if (!list.length) return "";
    var slug = String(urlPath || "").replace(/^\/+|\/+$/g, "").toLowerCase();
    if (slug) {
      for (var i = 0; i < list.length; i++) {
        var norm = String(list[i])
          .replace(/\/index\.html?$/i, "")
          .replace(/\.html?$/i, "")
          .replace(/^\/+/, "")
          .toLowerCase();
        if (norm === slug || norm.slice(-slug.length - 1) === "/" + slug) return list[i];
      }
    }
    return list[0];
  }

  function nextLink(header) {
    if (!header) return "";
    var bits = String(header).split(",");
    for (var i = 0; i < bits.length; i++) {
      var match = bits[i].match(/<([^>]+)>;\s*rel="?next"?/i);
      if (match && isGitHubApiUrl(match[1])) return match[1];
    }
    return "";
  }

  function mimeFor(path) {
    var ext = String(path || "").split(".").pop().toLowerCase().split("?")[0];
    var map = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      avif: "image/avif",
      ico: "image/x-icon",
      css: "text/css",
      html: "text/html",
      htm: "text/html",
      js: "text/javascript",
      json: "application/json",
      woff: "font/woff",
      woff2: "font/woff2",
      ttf: "font/ttf",
      otf: "font/otf"
    };
    return map[ext] || "application/octet-stream";
  }

  function parseReview(text) {
    return JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  }

  function withReviewMeta(jsonText, title, description) {
    var data = parseReview(jsonText);
    data.title = title;
    data.meta_description = description;
    return JSON.stringify(data, null, 2) + "\n";
  }

  function articleRoot(doc) {
    return doc.querySelector("article") || doc.querySelector("main") || doc.body;
  }

  function isSkipped(el) {
    if (!el || !el.closest) return true;
    if (el.closest("script, style, noscript, svg, textarea, nav, footer, template, form")) return true;
    var header = el.closest("header");
    if (header && !header.closest("article")) return true;
    return false;
  }

  function hasText(el) {
    var nodes = el.childNodes || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && String(nodes[i].textContent || "").trim()) return true;
    }
    return String(el.textContent || "").replace(/\s+/g, "").length > 0;
  }

  function containsTextBlock(el) {
    var selector = TEXT_BLOCKS.join(",");
    var inner = el.querySelector(selector);
    return !!(inner && inner !== el);
  }

  function markEditable(doc) {
    var root = articleRoot(doc);
    if (!root) return;
    root.querySelectorAll("[data-rm-edit]").forEach(function (el) {
      el.removeAttribute("data-rm-edit");
    });
    var nodes = root.querySelectorAll(TEXT_BLOCKS.join(","));
    var index = 0;
    nodes.forEach(function (el) {
      if (isSkipped(el)) return;
      if (el.closest("[data-rm-meta]")) return;
      var tag = el.tagName.toLowerCase();
      if ((tag === "blockquote" || tag === "li" || tag === "td" || tag === "th" || tag === "dd" || tag === "pre") && containsTextBlock(el)) return;
      if (!hasText(el)) return;
      el.setAttribute("data-rm-edit", String(index));
      index += 1;
    });
  }

  function sanitizeEditableHtml(html) {
    var doc = new DOMParser().parseFromString("<!DOCTYPE html><html><body>" + String(html || "") + "</body></html>", "text/html");
    var body = doc.body;
    body.querySelectorAll("script, style, iframe, object, embed, link, meta, base, form, svg").forEach(function (node) {
      node.remove();
    });
    body.querySelectorAll("*").forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = String(attr.value || "").trim().toLowerCase();
        if (name.indexOf("on") === 0 || name === "contenteditable" || name === "data-rm-edit" || name === "data-rm-meta") {
          el.removeAttribute(attr.name);
        }
        if ((name === "href" || name === "src" || name === "xlink:href") && (value.indexOf("javascript:") === 0 || value.indexOf("data:text/html") === 0)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return body.innerHTML;
  }

  function serializeDocument(doc) {
    var name = doc.doctype && doc.doctype.name ? doc.doctype.name : "html";
    return "<!DOCTYPE " + name + ">\n" + doc.documentElement.outerHTML + "\n";
  }

  function setNamedMeta(doc, selector, attr, content) {
    var node = doc.querySelector(selector);
    if (!node) return;
    node.setAttribute(attr, content);
  }

  function setTitle(doc, title, originalH1) {
    var el = doc.querySelector("title");
    if (!el) {
      el = doc.createElement("title");
      (doc.head || doc.documentElement).appendChild(el);
    }
    var current = el.textContent || "";
    if (originalH1 && current.indexOf(originalH1) !== -1 && originalH1 !== title) {
      el.textContent = current.split(originalH1).join(title);
    } else {
      el.textContent = title;
    }
    var og = doc.querySelector('meta[property="og:title"]');
    if (og) {
      var ogText = og.getAttribute("content") || "";
      if (originalH1 && ogText.indexOf(originalH1) !== -1 && originalH1 !== title) {
        og.setAttribute("content", ogText.split(originalH1).join(title));
      } else {
        og.setAttribute("content", title);
      }
    }
  }

  function setDescription(doc, description) {
    var meta = doc.querySelector('meta[name="description"]');
    if (!meta) {
      meta = doc.createElement("meta");
      meta.setAttribute("name", "description");
      (doc.head || doc.documentElement).appendChild(meta);
    }
    meta.setAttribute("content", description);
    setNamedMeta(doc, 'meta[property="og:description"]', "content", description);
  }

  function applyEdits(originalHtml, editMap, updates) {
    var full = /<html[\s>]/i.test(originalHtml);
    var source = full ? originalHtml : "<!DOCTYPE html><html><body>" + originalHtml + "</body></html>";
    var doc = new DOMParser().parseFromString(source, "text/html");
    markEditable(doc);
    doc.querySelectorAll("[data-rm-edit]").forEach(function (el) {
      var id = el.getAttribute("data-rm-edit");
      if (editMap && Object.prototype.hasOwnProperty.call(editMap, id)) {
        el.innerHTML = sanitizeEditableHtml(editMap[id]);
      }
      el.removeAttribute("data-rm-edit");
      el.removeAttribute("contenteditable");
    });
    if (updates && updates.title != null) setTitle(doc, updates.title, updates.originalH1 || "");
    if (updates && updates.description != null) setDescription(doc, updates.description);
    doc.querySelectorAll("[data-rm-meta], [data-rm-hero], [data-rm-preview]").forEach(function (node) {
      node.remove();
    });
    if (!full) return doc.body.innerHTML;
    return serializeDocument(doc);
  }

  function escapeHtmlText(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function decodeEntities(text) {
  return String(text == null ? "" : text)
    .replace(/&#(\d+);/g, function (_, n) { return codePoint(Number(n)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return codePoint(parseInt(n, 16)); })
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function codePoint(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  try { return String.fromCodePoint(n); }
  catch (err) { return ""; }
}

function readTagNameAt(html, lt) {
  var match = String(html).slice(lt + 1).match(/^([A-Za-z][A-Za-z0-9:-]*)/);
  return match ? match[1].toLowerCase() : "";
}

function readCloseName(html, lt) {
  var match = String(html).slice(lt + 2).match(/^([A-Za-z][A-Za-z0-9:-]*)/);
  return match ? match[1].toLowerCase() : "";
}

function findTagEnd(html, start) {
  var quote = "";
  for (var i = start; i < html.length; i++) {
    var ch = html.charAt(i);
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ">") return i;
  }
  return -1;
}

function skipRawText(html, openEnd, name) {
  var rest = html.slice(openEnd + 1);
  var match = rest.match(new RegExp("</" + name + "\\s*>", "i"));
  if (!match) return html.length;
  return openEnd + 1 + match.index + match[0].length;
}

function findMatchingClose(html, from, tag) {
  var depth = 1;
  var i = from;
  while (i < html.length) {
    var lt = html.indexOf("<", i);
    if (lt === -1) return -1;
    if (html.startsWith("<!--", lt)) {
      var commentEnd = html.indexOf("-->", lt + 4);
      i = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }
    if (html.charAt(lt + 1) === "/") {
      var closeName = readCloseName(html, lt);
      var closeEnd = findTagEnd(html, lt);
      if (closeName === tag) {
        depth -= 1;
        if (depth === 0) return lt;
      }
      i = closeEnd === -1 ? html.length : closeEnd + 1;
      continue;
    }
    var name = readTagNameAt(html, lt);
    var openEnd = findTagEnd(html, lt);
    if (openEnd === -1) return -1;
    var selfClose = /\/\s*$/.test(html.slice(lt + 1, openEnd));
    if (!selfClose && (name === "script" || name === "style" || name === "textarea")) {
      i = skipRawText(html, openEnd, name);
      continue;
    }
    if (name === tag && !selfClose) depth += 1;
    i = openEnd + 1;
  }
  return -1;
}

function replaceNthElementInner(html, tagName, index, newInner) {
  var source = String(html || "");
  var tag = String(tagName || "").toLowerCase();
  var found = 0;
  var i = 0;
  while (i < source.length) {
    var lt = source.indexOf("<", i);
    if (lt === -1) break;
    if (source.startsWith("<!--", lt)) {
      var commentEnd = source.indexOf("-->", lt + 4);
      i = commentEnd === -1 ? source.length : commentEnd + 3;
      continue;
    }
    if (source.charAt(lt + 1) === "!" || source.charAt(lt + 1) === "?") {
      var declEnd = source.indexOf(">", lt + 2);
      i = declEnd === -1 ? source.length : declEnd + 1;
      continue;
    }
    if (source.charAt(lt + 1) === "/") {
      i = lt + 1;
      continue;
    }
    var name = readTagNameAt(source, lt);
    if (!name) {
      i = lt + 1;
      continue;
    }
    var openEnd = findTagEnd(source, lt);
    if (openEnd === -1) break;
    var selfClose = /\/\s*$/.test(source.slice(lt + 1, openEnd));
    if (!selfClose && (name === "script" || name === "style" || name === "textarea") && !(name === tag && found === index)) {
      i = skipRawText(source, openEnd, name);
      continue;
    }
    if (name !== tag || selfClose) {
      i = openEnd + 1;
      continue;
    }
    var closeStart = findMatchingClose(source, openEnd + 1, tag);
    if (closeStart === -1) break;
    if (found === index) {
      return source.slice(0, openEnd + 1) + String(newInner == null ? "" : newInner) + source.slice(closeStart);
    }
    found += 1;
    i = closeStart;
  }
  throw new Error("Could not find <" + tag + "> " + index);
}

function rewriteTitleText(current, originalH1, title) {
  var next = String(title == null ? "" : title);
  var old = String(originalH1 || "");
  if (old && String(current).indexOf(old) !== -1) {
    if (old === next) return current;
    return String(current).split(old).join(next);
  }
  return next;
}

function replaceOnce(html, pattern, replacer) {
  var done = false;
  return String(html || "").replace(pattern, function () {
    if (done) return arguments[0];
    done = true;
    return replacer.apply(null, arguments);
  });
}

function updateTitleInHtml(html, title, originalH1) {
  var next = replaceOnce(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, function (full) {
    var match = full.match(/^<title(\s[^>]*)?>([\s\S]*)<\/title>$/i);
    if (!match) return full;
    var decoded = decodeEntities(match[2]);
    var rewritten = rewriteTitleText(decoded, originalH1, title);
    if (rewritten === decoded) return full;
    return "<title" + (match[1] || "") + ">" + escapeHtmlText(rewritten) + "</title>";
  });
  next = replaceMetaByKey(next, "property", "og:title", function (current) {
    return rewriteTitleText(current, originalH1, title);
  });
  next = replaceMetaByKey(next, "name", "twitter:title", function (current) {
    return rewriteTitleText(current, originalH1, title);
  });
  return next;
}

function updateDescriptionInHtml(html, description) {
  var next = replaceMetaByKey(html, "name", "description", function () { return description; });
  next = replaceMetaByKey(next, "property", "og:description", function () { return description; });
  next = replaceMetaByKey(next, "name", "twitter:description", function () { return description; });
  return next;
}

function readMetaAttr(tag, name) {
  var match = String(tag).match(new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))", "i"));
  if (!match) return null;
  if (match[1] != null) return match[1];
  if (match[2] != null) return match[2];
  return match[3];
}

function setMetaAttr(tag, name, value) {
  var pattern = new RegExp("(\\s" + name + "\\s*=\\s*)(\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+)", "i");
  return String(tag).replace(pattern, function (_, prefix, quoted) {
    var quote = quoted.charAt(0) === "'" ? "'" : "\"";
    var safe = escapeHtmlAttr(value);
    if (quote === "'") safe = safe.replace(/'/g, "&#39;");
    return prefix + quote + safe + quote;
  });
}

function replaceMetaByKey(html, attr, expected, nextValue) {
  return String(html || "").replace(/<meta\b[^>]*>/gi, function (tag) {
    var found = readMetaAttr(tag, attr);
    if (found == null || decodeEntities(found).toLowerCase() !== String(expected).toLowerCase()) return tag;
    var current = readMetaAttr(tag, "content");
    if (current == null) return tag;
    var value = nextValue(decodeEntities(current));
    if (value == null || decodeEntities(current) === String(value)) return tag;
    return setMetaAttr(tag, "content", value);
  });
}

function applyArticle(html, tagName, index, newInner, updates) {
  var next = replaceNthElementInner(html, tagName, index, newInner);
  if (updates && updates.title != null) next = updateTitleInHtml(next, updates.title, updates.originalH1 || "");
  if (updates && updates.description != null) next = updateDescriptionInHtml(next, updates.description);
  return next;
}

function diffWords(before, after) {
  var a = tokenizeWords(before);
  var b = tokenizeWords(after);
  return mergeDiffOps(diffTokenList(a, b));
}

function tokenizeWords(text) {
  return String(text == null ? "" : text).split(/(\s+)/).filter(function (part) { return part.length; });
}

function mergeDiffOps(ops) {
  var out = [];
  (ops || []).forEach(function (op) {
    var last = out[out.length - 1];
    if (last && last.op === op.op) last.text += op.text;
    else out.push({ op: op.op, text: op.text });
  });
  return out;
}

function diffTokenList(a, b) {
  var n = a.length;
  var m = b.length;
  if (!n && !m) return [];
  if (!n) return [{ op: "insert", text: b.join("") }];
  if (!m) return [{ op: "delete", text: a.join("") }];
  var max = n + m;
  var v = { 1: 0 };
  var trace = [];
  var found = false;
  for (var d = 0; d <= max && !found; d++) {
    trace.push(Object.assign({}, v));
    for (var k = -d; k <= d; k += 2) {
      var x;
      if (k === -d || (k !== d && (v[k - 1] || 0) < (v[k + 1] || 0))) x = v[k + 1] || 0;
      else x = (v[k - 1] || 0) + 1;
      var y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  if (!found) return [{ op: "delete", text: a.join("") }, { op: "insert", text: b.join("") }];
  var x = n;
  var y = m;
  var ops = [];
  for (var depth = trace.length - 1; depth >= 0; depth--) {
    var snapshot = trace[depth];
    var diag = x - y;
    var prevK;
    if (diag === -depth || (diag !== depth && (snapshot[diag - 1] || 0) < (snapshot[diag + 1] || 0))) prevK = diag + 1;
    else prevK = diag - 1;
    var prevX = snapshot[prevK] || 0;
    var prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ op: "equal", text: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (depth === 0) break;
    if (x === prevX) {
      ops.push({ op: "insert", text: b[prevY] });
      y = prevY;
    } else {
      ops.push({ op: "delete", text: a[prevX] });
      x = prevX;
    }
  }
  ops.reverse();
  return ops;
}

function formatSendBackNote(note, comments) {
  var lines = [];
  var main = String(note || "").trim();
  if (main) lines.push(main);
  var notes = (comments || []).filter(function (item) {
    return item && String(item.note || "").trim();
  });
  if (notes.length) {
    if (lines.length) lines.push("");
    lines.push("Notes on the draft:");
    notes.forEach(function (item) {
      var quote = String(item.quote || "").replace(/\s+/g, " ").trim();
      var text = String(item.note || "").trim();
      if (quote) lines.push("- \"" + quote + "\": " + text);
      else lines.push("- " + text);
    });
  }
  return lines.join("\n").trim();
}

function autosaveKey(repo, pr, path) {
  return "rm-editor-draft:" + String(repo || "") + ":" + String(pr || "") + ":" + String(path || "");
}

var PENDING_PREFIX = "rm-editor-pending:";
var PERMISSION_CONTENTS = "Contents: Read and write";
var PERMISSION_PULLS = "Pull requests: Read and write";
var TOKEN_SETTINGS_URL = "https://github.com/settings/personal-access-tokens";

function isFineGrainedToken(value) {
  return cleanToken(value).indexOf("github_pat_") === 0;
}

function repoLabel(full) {
  var parts = String(full || "").split("/");
  return parts[parts.length - 1] || String(full || "");
}

function pendingKey(repo, number, jsonPath) {
  return PENDING_PREFIX + String(repo || "") + ":" + String(number || "") + ":" + String(jsonPath || "");
}

function plainText(value) {
  var text = String(value == null ? "" : value);
  if (/<!doctype|<html\b|<body\b|<head\b/i.test(text)) return "GitHub sent a page instead of an answer.";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isAccessError(status, message) {
  var text = String(message || "").toLowerCase();
  if (text.indexOf("rate limit") !== -1) return false;
  if (Number(status) === 403) return true;
  return text.indexOf("not accessible") !== -1 || text.indexOf("personal access token") !== -1;
}

function probeAllows(result, kind) {
  var code = Number(result && result.status) || 0;
  var text = String(result && result.message || "").toLowerCase();
  if (!code) return null;
  if (text.indexOf("rate limit") !== -1) return null;
  if (code === 401) return false;
  if (code === 403) return false;
  if (kind === "repo" && code === 404) return false;
  return true;
}

function missingPermissionNames(probe) {
  if (!probe || probe.unknown) return [];
  var missing = [];
  if (probe.contentsRead === false || probe.contentsWrite === false) missing.push(PERMISSION_CONTENTS);
  if (probe.pullsRead === false || probe.pullsWrite === false) missing.push(PERMISSION_PULLS);
  return missing;
}

function permissionBanner(entries) {
  var groups = [];
  (entries || []).forEach(function (entry) {
    var missing = entry && entry.missing ? entry.missing : missingPermissionNames(entry);
    if (!missing.length) return;
    var key = missing.join("|");
    var group = null;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].key === key) group = groups[i];
    }
    if (!group) {
      group = { key: key, missing: missing.slice(), repos: [] };
      groups.push(group);
    }
    group.repos.push(repoLabel(entry.repo));
  });
  if (!groups.length) return "";
  return groups.map(function (group) {
    return "Missing " + group.missing.join(", ") + " on " + group.repos.join(", ");
  }).join(". ") + ".";
}

function permissionsFromFailure(url, status, message, accepted) {
  if (!isAccessError(status, message) && !String(accepted || "")) return [];
  var header = String(accepted || "").toLowerCase();
  var names = [];
  if (header.indexOf("contents") !== -1) names.push(PERMISSION_CONTENTS);
  if (header.indexOf("pull_request") !== -1 || header.indexOf("pull-request") !== -1) names.push(PERMISSION_PULLS);
  if (names.length) return names;
  var path = String(url || "").toLowerCase();
  if (/\/graphql/.test(path) || /\/pulls\/|\/issues\/|\/merges|\/labels/.test(path)) return [PERMISSION_PULLS];
  if (/\/git\/|\/contents\//.test(path)) return [PERMISSION_CONTENTS];
  if (isAccessError(status, message)) return [PERMISSION_CONTENTS, PERMISSION_PULLS];
  return [];
}

function writeFailureMessage(opts) {
  opts = opts || {};
  var perms = opts.permissions && opts.permissions.length ? opts.permissions : [PERMISSION_CONTENTS, PERMISSION_PULLS];
  var repo = repoLabel(opts.repo);
  var kept;
  if (opts.committed && opts.kept === "note") {
    kept = "The edits are saved on the branch. The note is still in this browser. GitHub did not receive the note.";
  } else if (opts.kept === "note") {
    kept = "The note is saved in this browser. GitHub did not receive it.";
  } else if (opts.committed) {
    kept = "The edits are saved on the branch. GitHub did not finish publishing.";
  } else {
    kept = "The edits are saved in this browser. GitHub did not receive them.";
  }
  var names = perms.map(function (item) {
    return String(item).replace(": Read and write", "");
  });
  var fix = names.length > 1 ? "set " + names.join(" and ") + " to Read and write" : "set " + names[0] + " to Read and write";
  return kept + " The token is missing " + perms.join(", ") + " on " + repo + ". Open token settings, " + fix + ", then press Retry.";
}

var PUBLISH_WORKFLOW_REPOS = ["ryanmoalemi/fullcourtbuckets"];

function usesPublishWorkflow(repo) {
  return PUBLISH_WORKFLOW_REPOS.indexOf(String(repo || "")) !== -1;
}

function publishNonce() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function publishWorkflowResult(comments, nonce) {
  var token = String(nonce || "");
  if (!token) return { status: "pending", message: "" };
  var latest = null;
  (comments || []).forEach(function (comment) {
    var body = String(comment && comment.body || "");
    var first = body.split(/\r?\n/)[0];
    var parts = first.split(/\s+/);
    var created = Date.parse(comment && comment.created_at || "") || 0;
    var failed = parts[0] === "fcb-publish:failed" && parts.indexOf(token) !== -1;
    var published = parts[0] === "fcb-publish:published" && parts.indexOf(token) !== -1;
    if (!failed && !published) return;
    if (!latest || created >= latest.created) latest = { created: created, body: body, failed: failed };
  });
  if (!latest) return { status: "pending", message: "" };
  if (latest.failed) {
    var message = latest.body.split(/\r?\n/).slice(1).join(" ").replace(/\s+/g, " ").trim();
    return { status: "failed", message: message };
  }
  return { status: "published", message: "" };
}

var SHARED_LISTING_EXACT = {
  "articles.json": true,
  "index.html": true,
  "news/index.html": true,
  "authors/ryan-moalemi/index.html": true,
  "pages-sitemap.xml": true,
  "sitemap.xml": true,
  "sitemap/index.html": true
};

function isSharedListing(path) {
  var name = String(path || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (SHARED_LISTING_EXACT[name]) return true;
  var parts = name.split("/");
  return parts.length === 4 && parts[0] === "wnba" && parts[1] === "teams" && parts[3] === "index.html";
}

function isMergeConflictError(status, message) {
  var text = String(message || "");
  return Number(status) === 409 || /merge conflict/i.test(text);
}

function hasConflictMarkers(text) {
  var value = String(text || "");
  return value.indexOf("<<<<<<<") !== -1 || value.indexOf(">>>>>>>") !== -1;
}

function indexTree(entries) {
  var map = {};
  (entries || []).forEach(function (entry) {
    if (!entry || entry.type === "tree" || !entry.path) return;
    map[entry.path] = { sha: entry.sha || "", mode: entry.mode || "100644" };
  });
  return map;
}

function integrationPlan(baseEntries, mainEntries, headEntries) {
  var base = indexTree(baseEntries);
  var main = indexTree(mainEntries);
  var head = indexTree(headEntries);
  var paths = {};
  Object.keys(base).forEach(function (path) { paths[path] = true; });
  Object.keys(main).forEach(function (path) { paths[path] = true; });
  Object.keys(head).forEach(function (path) { paths[path] = true; });
  var overlay = [];
  var protectedShas = {};
  Object.keys(paths).forEach(function (path) {
    if (isSharedListing(path)) return;
    var baseSha = base[path] ? base[path].sha : "";
    var mainSha = main[path] ? main[path].sha : "";
    var headSha = head[path] ? head[path].sha : "";
    var headMode = head[path] ? head[path].mode : "";
    var mainMode = main[path] ? main[path].mode : "";
    var prTouched = headSha !== baseSha;
    var resultSha = prTouched ? headSha : mainSha;
    var resultMode = prTouched ? headMode : mainMode;
    if (prTouched && headSha) protectedShas[path] = headSha;
    if (resultSha === mainSha) return;
    overlay.push({
      path: path,
      mode: resultMode || "100644",
      type: "blob",
      sha: resultSha || null
    });
  });
  return { overlay: overlay, protectedShas: protectedShas };
}

function protectedDrift(protectedShas, mainEntries, overlay) {
  var main = indexTree(mainEntries);
  var placed = {};
  (overlay || []).forEach(function (entry) {
    if (entry && entry.path && entry.sha) placed[entry.path] = entry.sha;
  });
  var drifted = "";
  Object.keys(protectedShas || {}).forEach(function (path) {
    if (drifted) return;
    var want = protectedShas[path];
    var have = placed[path] || (main[path] && main[path].sha) || "";
    if (have !== want) drifted = path;
  });
  return drifted;
}

function mergeArticleLists(mainArticles, prArticles) {
  var bySlug = {};
  function take(list) {
    (list || []).forEach(function (article) {
      if (!article || typeof article !== "object") return;
      var slug = String(article.slug || "").trim();
      if (!slug) return;
      bySlug[slug] = Object.assign({}, article);
    });
  }
  take(mainArticles);
  take(prArticles);
  var ordered = [];
  var seen = {};
  function push(list) {
    (list || []).forEach(function (article) {
      if (!article || typeof article !== "object") return;
      var slug = String(article.slug || "").trim();
      if (!slug || seen[slug] || !bySlug[slug]) return;
      seen[slug] = true;
      ordered.push(bySlug[slug]);
    });
  }
  push(prArticles);
  push(mainArticles);
  ordered.sort(function (a, b) {
    var left = String(a.date || "");
    var right = String(b.date || "");
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
  return ordered;
}

function articleSlugOk(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ""));
}

function articleHref(article) {
  var slug = String(article && article.slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!articleSlugOk(slug)) return "";
  return "/news/" + slug + "/";
}

function prepareArticles(mainArticles, prArticles) {
  return mergeArticleLists(mainArticles, prArticles).map(function (article) {
    var href = articleHref(article);
    var ordered = {};
    ["slug", "url", "title", "description", "category", "date", "image", "imageAlt"].forEach(function (key) {
      if (key === "url") {
        if (href) ordered.url = href;
      } else if (Object.prototype.hasOwnProperty.call(article, key)) {
        ordered[key] = article[key];
      }
    });
    Object.keys(article).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(ordered, key)) ordered[key] = article[key];
    });
    return ordered;
  }).filter(function (article) { return articleHref(article); });
}

function orderedArticles(articles) {
  return (articles || []).slice().sort(function (a, b) {
    var left = String(a && a.date || "");
    var right = String(b && b.date || "");
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
}

function escHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function formatStoryDate(iso) {
  var parts = String(iso || "").split("-");
  if (parts.length < 3) return "";
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var month = months[Number(parts[1]) - 1];
  var day = Number(parts[2]);
  if (!month || !day) return "";
  return month + " " + day + ", " + parts[0];
}

function newsListItem(article) {
  var title = String(article.title || "");
  var summary = String(article.description || "");
  var image = String(article.image || "");
  var alt = String(article.imageAlt || title);
  var when = String(article.date || "");
  var label = formatStoryDate(when);
  var thumb = image ? '<img src="' + escHtml(image) + '" alt="' + escHtml(alt) + '">' : "";
  return '<li><a class="news-item" href="' + escHtml(articleHref(article)) + '">' + thumb +
    '<span class="news-copy"><time datetime="' + escHtml(when) + '">' + escHtml(label) + "</time>" +
    "<h2>" + escHtml(title) + "</h2><p>" + escHtml(summary) + "</p></span></a></li>";
}

function storyCard(article) {
  var title = String(article.title || "");
  var image = String(article.image || "");
  var alt = String(article.imageAlt || title);
  return '<a class="article-card" href="' + escHtml(articleHref(article)) + '">' +
    '<div class="article-visual"><img src="' + escHtml(image) + '" alt="' + escHtml(alt) + '"></div>' +
    '<div class="article-copy"><div class="cat">' + escHtml(article.category || "") + "</div>" +
    "<h3>" + escHtml(title) + "</h3><p>" + escHtml(article.description || "") + "</p>" +
    '<div class="date">' + escHtml(formatStoryDate(article.date)) + "</div></div></a>";
}

function replaceMarked(text, name, inner) {
  var pattern = new RegExp("<!-- " + name + ":start -->[\\s\\S]*?<!-- " + name + ":end -->");
  var block = "<!-- " + name + ":start -->" + inner + "<!-- " + name + ":end -->";
  if (pattern.test(text)) return text.replace(pattern, block);
  return text;
}

function applyHomepageStories(text, articles) {
  var html = String(text || "");
  if (html.indexOf('id="latest"') === -1 || html.indexOf('id="older-stories"') === -1) return html;
  var ordered = orderedArticles(articles);
  if (!ordered.length) return html;
  var featured = ordered[0];
  var href = articleHref(featured);
  html = html.replace(/(<a class="feature feature-link" id="featured-story" href=")[^"]*(")/, function (match, open, close) {
    return open + href + close;
  });
  html = html.replace(/(<h1 id="featured-title">)[\s\S]*?(<\/h1>)/, function (match, open, close) {
    return open + escHtml(featured.title || "") + close;
  });
  html = html.replace(/(<p id="featured-dek">)[\s\S]*?(<\/p>)/, function (match, open, close) {
    return open + escHtml(featured.description || "") + close;
  });
  var meta = String(featured.category || "") + " · " + formatStoryDate(featured.date);
  html = html.replace(/(<div class="meta" id="featured-meta">)[\s\S]*?(<\/div>)/, function (match, open, close) {
    return open + escHtml(meta) + close;
  });
  var cards = ordered.slice(1).map(storyCard).join("");
  if (html.indexOf("<!-- fcb-stories:start -->") !== -1) {
    html = replaceMarked(html, "fcb-stories", cards);
  } else {
    html = html.replace(
      '<div class="story-list" id="older-stories"></div>',
      '<div class="story-list" id="older-stories"><!-- fcb-stories:start -->' + cards + "<!-- fcb-stories:end --></div>"
    );
  }
  return html;
}

function articleTickerInner(html) {
  var match = /<div class="ticker-text">([\s\S]*?)<\/div>/.exec(String(html || ""));
  return match ? match[1] : "";
}

function applyHomepageTicker(html, inner) {
  var text = String(html || "");
  if (!inner || text.indexOf('<div class="ticker-text">') === -1) return text;
  var used = false;
  return text.replace(/<div class="ticker-text">[\s\S]*?<\/div>/, function (match) {
    if (used) return match;
    used = true;
    return match.slice(0, match.indexOf(">") + 1) + inner + "</div>";
  });
}

function replaceNewsList(html, articles) {
  var text = String(html || "");
  if (text.indexOf('class="news-list"') === -1) return text;
  var cards = orderedArticles(articles).map(newsListItem).join("");
  return text.replace(/<ol class="news-list">[\s\S]*?<\/ol>/, '<ol class="news-list">' + cards + "</ol>");
}

function syncNewsSitemap(text, articles) {
  var xml = String(text || "");
  if (xml.indexOf("</urlset>") === -1) return xml;
  var base = "https://fullcourtbuckets.com";
  (articles || []).forEach(function (article) {
    var href = articleHref(article);
    if (!href) return;
    var slug = String(article.slug || "").trim();
    var oldLoc = base + "/" + slug + "/";
    var next = base + href;
    xml = xml.replace(new RegExp("(<loc>\\s*)" + oldLoc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s*</loc>)"), function (match, open, close) {
      return open + next + close;
    });
    if (xml.indexOf(next) === -1) {
      var lastmod = String(article.date || "2026-09-29");
      var block = "  <url>\n    <loc>" + next + "</loc>\n    <lastmod>" + lastmod + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n";
      xml = xml.replace("</urlset>", block + "</urlset>");
    }
  });
  var hub = base + "/news/";
  if (!new RegExp("<loc>\\s*" + hub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*</loc>").test(xml)) {
    xml = xml.replace("</urlset>", "  <url>\n    <loc>" + hub + "</loc>\n    <lastmod>2026-09-29</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>");
  }
  return xml;
}

function sitemapNewsSection(articles, hasCouples) {
  var items = [];
  orderedArticles(articles).forEach(function (article) {
    var href = articleHref(article);
    if (!href) return;
    items.push("<li><a href=\"" + escHtml(href) + "\">" + escHtml(article.title || article.slug) + "</a></li>");
  });
  if (hasCouples) items.push('<li><a href="/wnba/couples/">WNBA Couples</a></li>');
  if (!items.length) return "";
  return '<section class="section" id="sitemap-news"><h2>News</h2><ul class="sitemap-list">' + items.join("") + "</ul></section>";
}

function refreshSitemapNews(html, articles, hasCouples) {
  var text = String(html || "");
  var section = sitemapNewsSection(articles, hasCouples);
  if (!section || text.indexOf('id="sitemap-news"') === -1) return text;
  return text.replace(/<section class="section" id="sitemap-news">[\s\S]*?<\/section>/, section);
}

function teamNewsSection(articles, teamSlug) {
  var slug = String(teamSlug || "");
  var name = slug.split("-").filter(Boolean).map(function (part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
  var items = [];
  orderedArticles(articles).forEach(function (article) {
    var title = String(article.title || "").trim();
    if (!title || !articleHref(article)) return;
    var teams = Array.isArray(article.teams) ? article.teams : [];
    var blob = title + " " + String(article.description || "");
    var named = false;
    if (name) {
      var pattern = new RegExp("(^|[^A-Za-z0-9])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9]|$)");
      named = pattern.test(blob);
    }
    if (teams.indexOf(slug) === -1 && !named) return;
    items.push('<li><a class="inline-link" href="' + escHtml(articleHref(article)) + '">' + escHtml(title) + "</a></li>");
  });
  if (!items.length) return "";
  return '<section class="section" id="team-news"><p class="eyebrow">News</p><h2>Latest stories</h2><ul class="teammate-list">' + items.join("") + "</ul></section>";
}

function refreshTeamNews(html, section) {
  var text = String(html || "");
  var pattern = /<section class="section" id="team-news">[\s\S]*?<\/section>/;
  if (pattern.test(text)) return text.replace(pattern, section || "");
  if (!section) return text;
  var needle = 'href="/wnba/teams/"';
  var index = text.indexOf(needle);
  if (index === -1) return text;
  var start = text.lastIndexOf("<p", index);
  if (start === -1) return text;
  return text.slice(0, start) + section + text.slice(start);
}

function rebuildSharedTexts(texts, articles, tickerInner, hasCouples) {
  var out = {};
  var conflict = "";
  function put(path, value) {
    if (value == null) return;
    if (!conflict && hasConflictMarkers(value)) conflict = path;
    out[path] = value;
  }
  if (texts && texts["index.html"] != null) {
    put("index.html", applyHomepageTicker(applyHomepageStories(texts["index.html"], articles), tickerInner));
  }
  if (texts && texts["news/index.html"] != null) put("news/index.html", replaceNewsList(texts["news/index.html"], articles));
  if (texts && texts["authors/ryan-moalemi/index.html"] != null) {
    put("authors/ryan-moalemi/index.html", replaceNewsList(texts["authors/ryan-moalemi/index.html"], articles));
  }
  ["pages-sitemap.xml", "sitemap.xml"].forEach(function (name) {
    if (texts && texts[name] != null) put(name, syncNewsSitemap(texts[name], articles));
  });
  if (texts && texts["sitemap/index.html"] != null) {
    put("sitemap/index.html", refreshSitemapNews(texts["sitemap/index.html"], articles, hasCouples));
  }
  Object.keys(texts || {}).forEach(function (path) {
    var match = /^wnba\/teams\/([^/]+)\/index\.html$/.exec(path);
    if (!match) return;
    put(path, refreshTeamNews(texts[path], teamNewsSection(articles, match[1])));
  });
  return { files: out, conflict: conflict };
}

function decodeGitBlob(blob) {
  var encoding = String(blob && blob.encoding || "");
  var content = String(blob && blob.content || "");
  if (encoding === "base64") {
    var clean = content.replace(/\s/g, "");
    if (typeof Buffer !== "undefined") return Buffer.from(clean, "base64").toString("utf8");
    var binary = atob(clean);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return content;
}

function pendingNeeds(item) {
  var steps = item && item.steps || {};
  var needs = [];
  if (steps.commit === "pending" || steps.sync === "pending") needs.push(PERMISSION_CONTENTS);
  if (steps.comment === "pending" || steps.label === "pending" || steps.ready === "pending" || steps.workflow === "pending" || steps.merge === "pending") needs.push(PERMISSION_PULLS);
  if (steps.sync === "pending" && needs.indexOf(PERMISSION_PULLS) === -1) needs.push(PERMISSION_PULLS);
  return needs;
}

function blockedPermissions(item, gaps) {
  var needs = pendingNeeds(item);
  if (!needs.length) return [];
  var repo = String(item && item.repo || "");
  var head = String(item && item.headRepo || "");
  var missing = [];
  (gaps || []).forEach(function (entry) {
    if (!entry) return;
    if (entry.repo !== repo && entry.repo !== head && repoLabel(entry.repo) !== repoLabel(repo)) return;
    var have = entry.missing || missingPermissionNames(entry);
    have.forEach(function (name) {
      if (needs.indexOf(name) !== -1 && missing.indexOf(name) === -1) missing.push(name);
    });
  });
  return missing;
}

function parsePending(raw) {
  try {
    var data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || typeof data !== "object") return null;
    if (!data.repo || data.number == null || data.number === "") return null;
    var action = data.action || "save";
    if (action !== "save" && action !== "send-back" && action !== "publish" && action !== "comment") return null;
    var steps = data.steps || {};
    function step(name, fallback) {
      var value = steps[name] || fallback;
      if (value !== "pending" && value !== "done" && value !== "skip") return fallback;
      return value;
    }
    return {
      action: action,
      repo: String(data.repo),
      headRepo: String(data.headRepo || data.repo),
      number: Number(data.number),
      jsonPath: String(data.jsonPath || ""),
      branch: String(data.branch || ""),
      nodeId: String(data.nodeId || ""),
      note: String(data.note || ""),
      comments: Array.isArray(data.comments) ? data.comments : [],
      title: String(data.title || ""),
      slug: String(data.slug || ""),
      description: String(data.description || ""),
      hero: String(data.hero || ""),
      body: String(data.body || ""),
      files: Array.isArray(data.files) ? data.files : [],
      steps: {
        commit: step("commit", "skip"),
        comment: step("comment", "skip"),
        label: step("label", "skip"),
        ready: step("ready", "skip"),
        sync: step("sync", "skip"),
        workflow: step("workflow", "skip"),
        merge: step("merge", "skip"),
        deploy: step("deploy", "skip")
      },
      savedAt: String(data.savedAt || ""),
      liveUrl: String(data.liveUrl || ""),
      workflowNonce: String(data.workflowNonce || ""),
      syncTree: String(data.syncTree || ""),
      syncMain: String(data.syncMain || "")
    };
  } catch (err) {
    return null;
  }
}

function isDraftMergeError(message) {
  return /still a draft/i.test(String(message || ""));
}

function graphqlProblems(body) {
  var errors = body && body.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map(function (err) {
    return {
      type: String(err && err.type || ""),
      message: plainText(err && err.message || "")
    };
  }).filter(function (err) { return err.message || err.type; });
}

function graphqlAccessError(body) {
  return graphqlProblems(body).some(function (err) {
    return err.type.toUpperCase() === "FORBIDDEN" || isAccessError(0, err.message);
  });
}

function graphqlMessage(body) {
  return graphqlProblems(body).map(function (err) { return err.message; }).filter(Boolean).join(" ");
}

function isLiveSiteUrl(url) {
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.hostname === "api.github.com" || parsed.hostname === "github.com") return false;
    return !!parsed.hostname;
  } catch (err) {
    return false;
  }
}

function livePageReady(html, title, status) {
  if (Number(status) !== 200) return false;
  var page = String(html || "");
  var want = String(title || "").replace(/\s+/g, " ").trim();
  if (!want) return true;
  if (page.indexOf(want) !== -1) return true;
  var escaped = escapeHtmlText(want);
  return !!escaped && escaped !== want && page.indexOf(escaped) !== -1;
}

function formatPacificTime(date) {
  var when = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(when.getTime())) return "";
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(when);
  var hour = "";
  var minute = "";
  var period = "";
  parts.forEach(function (part) {
    if (part.type === "hour") hour = part.value;
    if (part.type === "minute") minute = part.value;
    if (part.type === "dayPeriod") period = String(part.value || "").toUpperCase();
  });
  if (!hour || !minute) return "";
  return hour + ":" + minute + (period ? " " + period : "") + " PT";
}

function pendingDone(item) {
  if (!item || !item.steps) return false;
  var names = ["commit", "comment", "label", "ready", "sync", "workflow", "merge", "deploy"];
  for (var i = 0; i < names.length; i++) {
    var value = item.steps[names[i]];
    if (value !== "done" && value !== "skip") return false;
  }
  return true;
}

function heroPresent(doc, hero) {
    if (!hero) return true;
    var target = String(hero).trim();
    var baseName = target.split("/").pop().split("?")[0];
    var nodes = doc.querySelectorAll("img, source");
    for (var i = 0; i < nodes.length; i++) {
      var src = nodes[i].getAttribute("src") || "";
      var srcset = nodes[i].getAttribute("srcset") || "";
      var hay = (src + " " + srcset).trim();
      if (!hay) continue;
      if (hay === target || src === target || src === baseName) return true;
      if (src.endsWith("/" + target) || src.endsWith("/" + baseName)) return true;
      if (hay.indexOf(target) !== -1 || hay.indexOf(baseName) !== -1) return true;
    }
    return false;
  }

  var api = {
    REPOS: REPOS,
    TOKEN_KEY: TOKEN_KEY,
    isGitHubApiUrl: isGitHubApiUrl,
    cleanToken: cleanToken,
    encodeRepoPath: encodeRepoPath,
    isExternalUrl: isExternalUrl,
    resolveRepoPath: resolveRepoPath,
    liveUrl: liveUrl,
    scoreMax: scoreMax,
    overallScore: overallScore,
    formatScore: formatScore,
    pointsScore: pointsScore,
    categoryScore: categoryScore,
    starCount: starCount,
    starLabel: starLabel,
    starPhrase: starPhrase,
    badgeFor: badgeFor,
    stringList: stringList,
    uniquenessBlock: uniquenessBlock,
    uniquePoints: uniquePoints,
    articleSummary: articleSummary,
    firstSentence: firstSentence,
    unverifiedList: unverifiedList,
    aiFlags: aiFlags,
    ageLabel: ageLabel,
    sortDrafts: sortDrafts,
    hasReviewLabel: hasReviewLabel,
    hasLabel: hasLabel,
    reviewJsonPaths: reviewJsonPaths,
    htmlFiles: htmlFiles,
    pickPrimaryFile: pickPrimaryFile,
    nextLink: nextLink,
    mimeFor: mimeFor,
    parseReview: parseReview,
    withReviewMeta: withReviewMeta,
    articleRoot: articleRoot,
    markEditable: markEditable,
    sanitizeEditableHtml: sanitizeEditableHtml,
    serializeDocument: serializeDocument,
    applyEdits: applyEdits,
    heroPresent: heroPresent,
    escapeHtmlText: escapeHtmlText,
    escapeHtmlAttr: escapeHtmlAttr,
    decodeEntities: decodeEntities,
    replaceNthElementInner: replaceNthElementInner,
    updateTitleInHtml: updateTitleInHtml,
    updateDescriptionInHtml: updateDescriptionInHtml,
    applyArticle: applyArticle,
    diffWords: diffWords,
    formatSendBackNote: formatSendBackNote,
    autosaveKey: autosaveKey,
    PENDING_PREFIX: PENDING_PREFIX,
    PERMISSION_CONTENTS: PERMISSION_CONTENTS,
    PERMISSION_PULLS: PERMISSION_PULLS,
    TOKEN_SETTINGS_URL: TOKEN_SETTINGS_URL,
    isFineGrainedToken: isFineGrainedToken,
    repoLabel: repoLabel,
    pendingKey: pendingKey,
    plainText: plainText,
    isAccessError: isAccessError,
    probeAllows: probeAllows,
    missingPermissionNames: missingPermissionNames,
    permissionBanner: permissionBanner,
    permissionsFromFailure: permissionsFromFailure,
    writeFailureMessage: writeFailureMessage,
    pendingNeeds: pendingNeeds,
    blockedPermissions: blockedPermissions,
    parsePending: parsePending,
    pendingDone: pendingDone,
    usesPublishWorkflow: usesPublishWorkflow,
    publishNonce: publishNonce,
    publishWorkflowResult: publishWorkflowResult,
    isSharedListing: isSharedListing,
    isMergeConflictError: isMergeConflictError,
    hasConflictMarkers: hasConflictMarkers,
    indexTree: indexTree,
    integrationPlan: integrationPlan,
    protectedDrift: protectedDrift,
    mergeArticleLists: mergeArticleLists,
    prepareArticles: prepareArticles,
    articleHref: articleHref,
    applyHomepageStories: applyHomepageStories,
    articleTickerInner: articleTickerInner,
    applyHomepageTicker: applyHomepageTicker,
    replaceNewsList: replaceNewsList,
    syncNewsSitemap: syncNewsSitemap,
    rebuildSharedTexts: rebuildSharedTexts,
    decodeGitBlob: decodeGitBlob,
    isDraftMergeError: isDraftMergeError,
    graphqlAccessError: graphqlAccessError,
    graphqlMessage: graphqlMessage,
    isLiveSiteUrl: isLiveSiteUrl,
    livePageReady: livePageReady,
    formatPacificTime: formatPacificTime
  };

  root.RMLib = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
