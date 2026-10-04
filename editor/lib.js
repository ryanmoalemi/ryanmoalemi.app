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
    autosaveKey: autosaveKey
  };

  root.RMLib = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
