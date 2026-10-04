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

  function scoreRatio(scorecard) {
    var sc = scorecard || {};
    var total = Number(sc.total);
    if (Number.isFinite(total)) return total / 100;
    var cats = Array.isArray(sc.categories) ? sc.categories : [];
    var max = 0;
    var sum = 0;
    cats.forEach(function (cat) {
      max += Number(cat && cat.max) || 0;
      sum += Number(cat && cat.score) || 0;
    });
    if (max > 0) return sum / max;
    return null;
  }

  function badgeFor(scorecard) {
    var sc = scorecard || {};
    var grade = String(sc.grade || "").trim().toUpperCase();
    if (grade.charAt(0) === "A") return { key: "ready", label: "Ready" };
    if (grade.charAt(0) === "B") return { key: "needs-work", label: "Needs work" };
    if (/^[CDF]/.test(grade)) return { key: "rework", label: "Rework" };
    var ratio = scoreRatio(sc);
    if (ratio == null) return { key: "needs-work", label: "Needs work" };
    if (ratio >= 0.8) return { key: "ready", label: "Ready" };
    if (ratio >= 0.6) return { key: "needs-work", label: "Needs work" };
    return { key: "rework", label: "Rework" };
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
    badgeFor: badgeFor,
    scoreRatio: scoreRatio,
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
    heroPresent: heroPresent
  };

  root.RMLib = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
