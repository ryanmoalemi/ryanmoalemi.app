(function (root) {
  var BLOCK_ALWAYS = {
    address: 1, article: 1, aside: 1, blockquote: 1, details: 1, div: 1, dl: 1,
    fieldset: 1, figcaption: 1, figure: 1, footer: 1, h1: 1, h2: 1, h3: 1, h4: 1,
    h5: 1, h6: 1, header: 1, li: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1,
    table: 1, tbody: 1, thead: 1, tfoot: 1, tr: 1, td: 1, th: 1, ul: 1, caption: 1,
    dd: 1, dt: 1, main: 1, label: 1, summary: 1, button: 1
  };
  var INLINE_TAGS = {
    a: 1, span: 1, small: 1, sub: 1, sup: 1, code: 1, abbr: 1, time: 1, cite: 1,
    q: 1, mark: 1, dfn: 1, kbd: 1, samp: 1, var: 1, wbr: 1, bdi: 1, bdo: 1
  };
  var MARK_TAGS = { strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline" };
  var RAW_TAGS = {
    form: 1, script: 1, style: 1, svg: 1, iframe: 1, canvas: 1, video: 1, audio: 1,
    object: 1, embed: 1, math: 1, textarea: 1, select: 1, noscript: 1, template: 1
  };
  var VOID_TAGS = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1,
    meta: 1, param: 1, source: 1, track: 1, wbr: 1
  };
  var MARK_ORDER = ["link", "bold", "italic", "underline"];

  function parseHtml(html) {
    return new DOMParser().parseFromString(String(html || ""), "text/html");
  }

  function editableRoot(doc) {
    var main = doc.querySelector("main");
    var articles = doc.querySelectorAll("article");
    if (main) {
      var h1 = main.querySelector("h1") || doc.querySelector("h1");
      if (articles.length === 1 && h1 && articles[0].contains(h1)) return articles[0];
      for (var i = 0; i < articles.length; i++) {
        if (!h1 || !articles[i].contains(h1)) continue;
        var aLen = (articles[i].textContent || "").length;
        var mLen = (main.textContent || "").length || 1;
        if (aLen > mLen * 0.6 && articles[i].querySelector("p, h2, table, figure")) return articles[i];
      }
      return main;
    }
    if (articles.length) return articles[0];
    return doc.body || doc.documentElement;
  }

  function rootAddress(doc) {
    var el = editableRoot(doc);
    var tag = el.tagName.toLowerCase();
    var all = el.ownerDocument.getElementsByTagName(tag);
    return { tag: tag, index: Array.prototype.indexOf.call(all, el) };
  }

  function attrsOf(el) {
    var out = {};
    var attrs = el.attributes || [];
    var any = false;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      var lower = name.toLowerCase();
      if (lower.indexOf("on") === 0 || lower === "contenteditable") continue;
      out[name] = attrs[i].value;
      any = true;
    }
    return any ? out : null;
  }

  function containsBlock(el) {
    var kids = el.children || [];
    for (var i = 0; i < kids.length; i++) {
      var tag = kids[i].tagName.toLowerCase();
      if (RAW_TAGS[tag] || tag === "hr" || tag === "table" || tag === "ul" || tag === "ol" || tag === "figure" || tag === "div" || tag === "section" || tag === "article" || tag === "p" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6" || tag === "blockquote" || tag === "details" || tag === "li" || tag === "figcaption" || tag === "tr" || tag === "td" || tag === "th" || tag === "thead" || tag === "tbody" || tag === "tfoot" || tag === "header" || tag === "footer" || tag === "nav" || tag === "form" || tag === "pre" || tag === "caption" || tag === "summary") {
        if (INLINE_TAGS[tag] || MARK_TAGS[tag]) {
          if (containsBlock(kids[i])) return true;
          continue;
        }
        if (tag === "div" || tag === "a" || tag === "span") {
          if (containsBlock(kids[i])) return true;
          if (BLOCK_ALWAYS[tag] && tag !== "div") return true;
          continue;
        }
        return true;
      }
      if (containsBlock(kids[i])) return true;
    }
    return false;
  }

  function normalizeSpaces(text, keep) {
    if (keep) return String(text || "");
    return String(text || "").replace(/[ \t\n\r\f]+/g, " ");
  }

  function trimEdges(nodes) {
    if (!nodes.length) return nodes;
    if (nodes[0].type === "text") {
      nodes[0] = copyNode(nodes[0], { text: nodes[0].text.replace(/^[ \t\n\r\f]+/, "") });
      if (!nodes[0].text) nodes.shift();
    }
    if (nodes.length && nodes[nodes.length - 1].type === "text") {
      var last = nodes[nodes.length - 1];
      nodes[nodes.length - 1] = copyNode(last, { text: last.text.replace(/[ \t\n\r\f]+$/, "") });
      if (!nodes[nodes.length - 1].text) nodes.pop();
    }
    return nodes.filter(function (node) {
      return node.type !== "text" || node.text;
    });
  }

  function copyNode(node, extra) {
    var next = {};
    Object.keys(node).forEach(function (key) { next[key] = node[key]; });
    Object.keys(extra || {}).forEach(function (key) { next[key] = extra[key]; });
    return next;
  }

  function withMark(nodes, mark) {
    return nodes.map(function (node) {
      if (node.type === "text" || node.type === "inlineImage" || node.type === "inlineVoid" || node.type === "hardBreak" || node.type === "inlineEl") {
        var marks = (node.marks || []).slice();
        marks.push(mark);
        return copyNode(node, { marks: marks });
      }
      return node;
    });
  }

  function parseInlineChildren(el, keepSpace) {
    var nodes = [];
    var children = el.childNodes || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) {
        var text = normalizeSpaces(child.textContent, keepSpace);
        if (!text) continue;
        if (!keepSpace && text === " " && !nodes.length) continue;
        nodes.push({ type: "text", text: text });
        continue;
      }
      if (child.nodeType !== 1) continue;
      var tag = child.tagName.toLowerCase();
      if (tag === "br") {
        nodes.push({ type: "hardBreak" });
        continue;
      }
      if (tag === "img") {
        nodes.push({ type: "inlineImage", attrs: { htmlAttrs: attrsOf(child) } });
        continue;
      }
      if (MARK_TAGS[tag] && !containsBlock(child)) {
        var inner = parseInlineChildren(child, keepSpace);
        var mark = { type: MARK_TAGS[tag], attrs: { tag: tag } };
        nodes = nodes.concat(withMark(inner, mark));
        continue;
      }
      if (tag === "a" && !containsBlock(child)) {
        var linked = parseInlineChildren(child, keepSpace);
        nodes = nodes.concat(withMark(linked, { type: "link", attrs: { htmlAttrs: attrsOf(child) } }));
        continue;
      }
      if (RAW_TAGS[tag]) {
        nodes.push({ type: "inlineVoid", attrs: { tag: "span", htmlAttrs: { "data-raw": "1" } } });
        continue;
      }
      var inlineKids = parseInlineChildren(child, keepSpace);
      if (!inlineKids.length) nodes.push({ type: "inlineVoid", attrs: { tag: tag, htmlAttrs: attrsOf(child) } });
      else nodes.push({ type: "inlineEl", attrs: { tag: tag, htmlAttrs: attrsOf(child) }, content: inlineKids });
    }
    return nodes;
  }

  function parseTextBlock(el) {
    var tag = el.tagName.toLowerCase();
    var keep = tag === "pre";
    return {
      type: "textBlock",
      attrs: { tag: tag, htmlAttrs: attrsOf(el) },
      content: trimEdges(parseInlineChildren(el, keep))
    };
  }

  function parseBlock(el) {
    var tag = el.tagName.toLowerCase();
    if (RAW_TAGS[tag] || tag === "input") {
      return { type: "raw", attrs: { html: el.outerHTML } };
    }
    if (tag === "hr") return { type: "voidBlock", attrs: { tag: "hr", htmlAttrs: attrsOf(el) } };
    if (tag === "img") return { type: "image", attrs: { htmlAttrs: attrsOf(el) } };
    if (!containsBlock(el) && tag !== "table" && tag !== "thead" && tag !== "tbody" && tag !== "tfoot" && tag !== "tr" && tag !== "ul" && tag !== "ol" && tag !== "figure" && tag !== "details") {
      return parseTextBlock(el);
    }
    return {
      type: "blockEl",
      attrs: { tag: tag, htmlAttrs: attrsOf(el) },
      content: parseBlockChildren(el)
    };
  }

  function parseBlockChildren(el) {
    var out = [];
    var children = el.childNodes || [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType === 3) {
        if (String(child.textContent || "").trim()) {
          out.push({
            type: "textBlock",
            attrs: { tag: "p", htmlAttrs: null },
            content: [{ type: "text", text: normalizeSpaces(child.textContent, false).trim() }]
          });
        }
        continue;
      }
      if (child.nodeType !== 1) continue;
      var tag = child.tagName.toLowerCase();
      if (tag === "img") {
        out.push({ type: "image", attrs: { htmlAttrs: attrsOf(child) } });
        continue;
      }
      if (tag === "br") continue;
      if (tag === "a" && !containsBlock(child)) {
        var inner = trimEdges(parseInlineChildren(child, false));
        out.push({
          type: "textBlock",
          attrs: { tag: "a", htmlAttrs: attrsOf(child) },
          content: inner
        });
        continue;
      }
      if (INLINE_TAGS[tag] && !containsBlock(child) && !BLOCK_ALWAYS[tag]) {
        var inlineKids = trimEdges(parseInlineChildren(child, false));
        out.push({
          type: "textBlock",
          attrs: { tag: "p", htmlAttrs: null },
          content: [{ type: inlineKids.length ? "inlineEl" : "inlineVoid", attrs: { tag: tag, htmlAttrs: attrsOf(child) }, content: inlineKids.length ? inlineKids : undefined }]
        });
        continue;
      }
      out.push(parseBlock(child));
    }
    return out.filter(Boolean);
  }

  function domToDoc(el) {
    var content = parseBlockChildren(el);
    if (!content.length) {
      content = [{ type: "textBlock", attrs: { tag: "p", htmlAttrs: null }, content: [] }];
    }
    return { type: "doc", content: content };
  }

  function parseFragment(html) {
    var doc = parseHtml("<!DOCTYPE html><html><body>" + String(html || "") + "</body></html>");
    return domToDoc(doc.body);
  }

  function escapeText(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return escapeText(value).replace(/"/g, "&quot;");
  }

  function attrString(htmlAttrs) {
    if (!htmlAttrs) return "";
    var parts = [];
    Object.keys(htmlAttrs).forEach(function (key) {
      if (!key || key.toLowerCase().indexOf("on") === 0) return;
      var val = htmlAttrs[key];
      if (val == null) return;
      parts.push(key + '="' + escapeAttr(val) + '"');
    });
    return parts.length ? " " + parts.join(" ") : "";
  }

  function relevantMarks(node) {
    return (node && node.marks || []).filter(function (mark) {
      return mark && mark.type && mark.type !== "comment";
    });
  }

  function markOf(node, type) {
    var marks = relevantMarks(node);
    for (var i = 0; i < marks.length; i++) if (marks[i].type === type) return marks[i];
    return null;
  }

  function outerMark(node) {
    for (var i = 0; i < MARK_ORDER.length; i++) {
      var found = markOf(node, MARK_ORDER[i]);
      if (found) return found;
    }
    return null;
  }

  function stableMark(mark) {
    if (!mark) return "";
    var attrs = mark.attrs || {};
    return mark.type + ":" + JSON.stringify(attrs);
  }

  function stripMark(node, type) {
    return copyNode(node, {
      marks: (node.marks || []).filter(function (mark) { return mark.type !== type; })
    });
  }

  function openMark(mark) {
    if (mark.type === "link") return "<a" + attrString(mark.attrs && mark.attrs.htmlAttrs) + ">";
    var tag = (mark.attrs && mark.attrs.tag) || (mark.type === "bold" ? "strong" : mark.type === "italic" ? "em" : "u");
    return "<" + tag + ">";
  }

  function closeMark(mark) {
    if (mark.type === "link") return "</a>";
    var tag = (mark.attrs && mark.attrs.tag) || (mark.type === "bold" ? "strong" : mark.type === "italic" ? "em" : "u");
    return "</" + tag + ">";
  }

  function serializeInline(nodes) {
    var html = "";
    var i = 0;
    nodes = nodes || [];
    while (i < nodes.length) {
      var outer = outerMark(nodes[i]);
      if (!outer) {
        html += serializeInlineNode(nodes[i]);
        i += 1;
        continue;
      }
      var key = stableMark(outer);
      var group = [];
      while (i < nodes.length && stableMark(outerMark(nodes[i])) === key) {
        group.push(stripMark(nodes[i], outer.type));
        i += 1;
      }
      html += openMark(outer) + serializeInline(group) + closeMark(outer);
    }
    return html;
  }

  function serializeInlineNode(node) {
    if (!node) return "";
    if (node.type === "text") return escapeText(node.text);
    if (node.type === "hardBreak") return "<br>";
    if (node.type === "inlineImage" || node.type === "image") return "<img" + attrString(node.attrs && node.attrs.htmlAttrs) + ">";
    if (node.type === "inlineVoid") {
      var tag = (node.attrs && node.attrs.tag) || "span";
      return "<" + tag + attrString(node.attrs && node.attrs.htmlAttrs) + "></" + tag + ">";
    }
    if (node.type === "inlineEl") {
      var inlineTag = (node.attrs && node.attrs.tag) || "span";
      return "<" + inlineTag + attrString(node.attrs && node.attrs.htmlAttrs) + ">" + serializeInline(node.content || []) + "</" + inlineTag + ">";
    }
    return "";
  }

  function serializeBlock(node) {
    if (!node) return "";
    if (node.type === "textBlock") {
      var tag = (node.attrs && node.attrs.tag) || "p";
      return "<" + tag + attrString(node.attrs && node.attrs.htmlAttrs) + ">" + serializeInline(node.content || []) + "</" + tag + ">";
    }
    if (node.type === "blockEl") {
      var blockTag = (node.attrs && node.attrs.tag) || "div";
      return "<" + blockTag + attrString(node.attrs && node.attrs.htmlAttrs) + ">" + (node.content || []).map(serializeBlock).join("") + "</" + blockTag + ">";
    }
    if (node.type === "image" || node.type === "inlineImage") return "<img" + attrString(node.attrs && node.attrs.htmlAttrs) + ">";
    if (node.type === "raw") return (node.attrs && node.attrs.html) || "";
    if (node.type === "voidBlock") {
      var voidTag = (node.attrs && node.attrs.tag) || "hr";
      return "<" + voidTag + attrString(node.attrs && node.attrs.htmlAttrs) + ">";
    }
    if (node.type === "doc") return (node.content || []).map(serializeBlock).join("");
    return "";
  }

  function serializeDoc(doc) {
    if (!doc) return "";
    if (doc.type === "doc") return (doc.content || []).map(serializeBlock).join("");
    return serializeBlock(doc);
  }

  function skipTag(html, i) {
    var quote = "";
    var j = i;
    while (j < html.length) {
      var c = html.charAt(j);
      if (quote) {
        if (c === quote) quote = "";
        j += 1;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        j += 1;
        continue;
      }
      if (c === ">") return j + 1;
      j += 1;
    }
    return html.length;
  }

  function findRegions(html, tag, index) {
    var seen = 0;
    var i = 0;
    var lowerTag = tag.toLowerCase();
    while (i < html.length) {
      var lt = html.indexOf("<", i);
      if (lt === -1) return null;
      if (html.substr(lt, 4) === "<!--") {
        var end = html.indexOf("-->", lt + 4);
        i = end === -1 ? html.length : end + 3;
        continue;
      }
      if (html.charAt(lt + 1) === "!" || html.charAt(lt + 1) === "?") {
        i = skipTag(html, lt + 2);
        continue;
      }
      var closing = html.charAt(lt + 1) === "/";
      var nameStart = lt + (closing ? 2 : 1);
      var nameEnd = nameStart;
      while (nameEnd < html.length && /[A-Za-z0-9]/.test(html.charAt(nameEnd))) nameEnd += 1;
      var name = html.slice(nameStart, nameEnd).toLowerCase();
      var tagEnd = skipTag(html, nameEnd);
      var selfClose = tagEnd - 2 >= 0 && html.charAt(tagEnd - 2) === "/";
      if (!closing && (name === "script" || name === "style")) {
        var closeTag = "</" + name;
        var closeAt = html.toLowerCase().indexOf(closeTag, tagEnd);
        i = closeAt === -1 ? html.length : skipTag(html, closeAt + closeTag.length);
        continue;
      }
      if (!closing && !selfClose && name === lowerTag) {
        if (seen === index) {
          var depth = 1;
          var cursor = tagEnd;
          while (cursor < html.length && depth > 0) {
            var next = html.indexOf("<", cursor);
            if (next === -1) return null;
            if (html.substr(next, 4) === "<!--") {
              var cend = html.indexOf("-->", next + 4);
              cursor = cend === -1 ? html.length : cend + 3;
              continue;
            }
            var isClose = html.charAt(next + 1) === "/";
            var nStart = next + (isClose ? 2 : 1);
            var nEnd = nStart;
            while (nEnd < html.length && /[A-Za-z0-9]/.test(html.charAt(nEnd))) nEnd += 1;
            var nName = html.slice(nStart, nEnd).toLowerCase();
            var nTagEnd = skipTag(html, nEnd);
            var nSelf = !isClose && nTagEnd - 2 >= 0 && html.charAt(nTagEnd - 2) === "/";
            if (!isClose && (nName === "script" || nName === "style")) {
              var innerClose = html.toLowerCase().indexOf("</" + nName, nTagEnd);
              cursor = innerClose === -1 ? html.length : skipTag(html, innerClose + nName.length + 2);
              continue;
            }
            if (nName === lowerTag && !nSelf) depth += isClose ? -1 : 1;
            if (depth === 0) return { openEnd: tagEnd, closeStart: next };
            cursor = nTagEnd;
          }
          return null;
        }
        seen += 1;
      }
      i = tagEnd;
    }
    return null;
  }

  function extractInner(html, tag, index) {
    var region = findRegions(html, tag, index);
    if (!region) return "";
    return html.slice(region.openEnd, region.closeStart);
  }

  function replaceInner(html, tag, index, inner) {
    var region = findRegions(html, tag, index);
    if (!region) return html;
    return html.slice(0, region.openEnd) + inner + html.slice(region.closeStart);
  }

  function decodeEntities(text) {
    var doc = parseHtml("<!DOCTYPE html><html><body><textarea id=\"t\">" + text + "</textarea></body></html>");
    var area = doc.getElementById("t");
    return area ? area.value : text;
  }

  function nextTitleText(current, title, originalH1) {
    var now = String(current || "");
    var next = String(title || "");
    var old = String(originalH1 || "");
    if (old && now.indexOf(old) !== -1 && old !== next) return now.split(old).join(next);
    return next;
  }

  function replaceTitle(html, title, originalH1) {
    var match = html.match(/<title([^>]*)>([\s\S]*?)<\/title>/i);
    if (!match) return html;
    var current = decodeEntities(match[2]);
    var next = nextTitleText(current, title, originalH1);
    if (next === current) return html;
    return html.replace(match[0], "<title" + match[1] + ">" + escapeText(next) + "</title>");
  }

  function replaceMetaContent(html, kind, key, value) {
    var re = /<meta\b[^>]*>/gi;
    var match;
    while ((match = re.exec(html))) {
      var tag = match[0];
      var attr = kind === "property" ? tag.match(/\bproperty\s*=\s*(['"])([\s\S]*?)\1/i) : tag.match(/\bname\s*=\s*(['"])([\s\S]*?)\1/i);
      if (!attr || attr[2].toLowerCase() !== key.toLowerCase()) continue;
      var content = tag.match(/\bcontent\s*=\s*(['"])([\s\S]*?)\1/i);
      if (!content) continue;
      var decoded = decodeEntities(content[2]);
      if (decoded === value) continue;
      var quote = content[1];
      var updated = tag.slice(0, content.index) + "content=" + quote + escapeAttr(value) + quote + tag.slice(content.index + content[0].length);
      return html.slice(0, match.index) + updated + html.slice(match.index + tag.length);
    }
    return html;
  }

  function applyDocument(originalHtml, fragmentHtml, updates) {
    var source = String(originalHtml || "");
    var doc = parseHtml(source);
    var address = rootAddress(doc);
    var next = replaceInner(source, address.tag, address.index, fragmentHtml == null ? "" : String(fragmentHtml));
    updates = updates || {};
    if (updates.title != null) next = replaceTitle(next, updates.title, updates.originalH1 || "");
    if (updates.description != null) {
      next = replaceMetaContent(next, "name", "description", updates.description);
      next = replaceMetaContent(next, "property", "og:description", updates.description);
      next = replaceMetaContent(next, "name", "twitter:description", updates.description);
    }
    if (updates.title != null) {
      var titleDoc = parseHtml(next);
      var titleText = titleDoc.querySelector("title") ? titleDoc.querySelector("title").textContent : updates.title;
      next = replaceMetaContent(next, "property", "og:title", titleText);
      var og = parseHtml(originalHtml).querySelector('meta[property="og:title"]');
      if (og) {
        var ogNext = nextTitleText(og.getAttribute("content") || "", updates.title, updates.originalH1 || "");
        next = replaceMetaContent(next, "property", "og:title", ogNext);
      }
      var tw = parseHtml(originalHtml).querySelector('meta[name="twitter:title"]');
      if (tw) {
        var twNext = nextTitleText(tw.getAttribute("content") || "", updates.title, updates.originalH1 || "");
        next = replaceMetaContent(next, "name", "twitter:title", twNext);
      }
    }
    if (updates.faqs && !sameFaqs(updates.originalFaqs || [], updates.faqs)) {
      var hadFaq = jsonLd(parseHtml(next)).some(scriptIsFaq);
      if (hadFaq) next = replaceFaqScripts(next, updates.faqs);
      else next = insertFaqScript(next, updates.faqs);
    }
    if (updates.heroSrc) {
      next = replaceMetaContent(next, "property", "og:image", updates.heroSrc);
      next = replaceMetaContent(next, "name", "twitter:image", updates.heroSrc);
    }
    return next;
  }

  function listAttr(el, name) {
    return el.getAttribute(name) || "";
  }

  function inventoryElement(root) {
    var images = [];
    var figures = [];
    var captions = [];
    var tables = [];
    var links = [];
    if (!root || !root.querySelectorAll) {
      return { images: images, figures: figures, captions: captions, tables: tables, links: links };
    }
    Array.prototype.forEach.call(root.querySelectorAll("img"), function (img) {
      images.push(listAttr(img, "src"));
    });
    Array.prototype.forEach.call(root.querySelectorAll("figure"), function (fig) {
      var img = fig.querySelector("img");
      figures.push((fig.getAttribute("class") || "") + "|" + (img ? listAttr(img, "src") : ""));
    });
    Array.prototype.forEach.call(root.querySelectorAll("figcaption"), function (cap) {
      captions.push((cap.textContent || "").replace(/\s+/g, " ").trim());
    });
    Array.prototype.forEach.call(root.querySelectorAll("table"), function (table) {
      tables.push(table.querySelectorAll("tr").length + "|" + (table.getAttribute("class") || ""));
    });
    Array.prototype.forEach.call(root.querySelectorAll("a"), function (a) {
      links.push(listAttr(a, "href") + "|" + (a.getAttribute("class") || ""));
    });
    return { images: images, figures: figures, captions: captions, tables: tables, links: links };
  }

  function jsonLd(doc) {
    var list = [];
    Array.prototype.forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), function (node) {
      list.push((node.textContent || "").trim());
    });
    return list;
  }

  function missingCount(required, actual) {
    var have = {};
    (actual || []).forEach(function (item) {
      var key = String(item);
      have[key] = (have[key] || 0) + 1;
    });
    var n = 0;
    (required || []).forEach(function (item) {
      var key = String(item);
      if (have[key]) have[key] -= 1;
      else n += 1;
    });
    return n;
  }

  function phrase(count, one, many) {
    if (!count) return "";
    return count === 1 ? one : count + " " + many;
  }

  function joinPhrases(items) {
    var list = items.filter(Boolean);
    if (!list.length) return "";
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + " and " + list[1];
    return list.slice(0, -1).join(", ") + ", and " + list[list.length - 1];
  }

  function fragmentInventory(fragmentHtml) {
    var doc = parseHtml("<!DOCTYPE html><html><body>" + String(fragmentHtml || "") + "</body></html>");
    return inventoryElement(doc.body);
  }

  function normFaq(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function inFaqRegion(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var id = (node.getAttribute("id") || "").toLowerCase();
      var cls = (node.getAttribute("class") || "").toLowerCase();
      if (id === "faq" || id.indexOf("faq") !== -1 || /(^|\s)faq(\s|$)/.test(cls)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function faqPairsFromRoot(root) {
    var pairs = [];
    if (!root || !root.querySelectorAll) return pairs;
    Array.prototype.forEach.call(root.querySelectorAll("article"), function (card) {
      var cls = (card.getAttribute("class") || "").split(/\s+/);
      if (cls.indexOf("card") === -1 || !inFaqRegion(card)) return;
      var heading = card.querySelector("h2, h3, h4");
      if (!heading) return;
      var answer = [];
      Array.prototype.forEach.call(card.querySelectorAll("p"), function (para) {
        answer.push(para.textContent || "");
      });
      pairs.push({ q: normFaq(heading.textContent), a: normFaq(answer.join(" ")) });
    });
    Array.prototype.forEach.call(root.querySelectorAll("details"), function (item) {
      var summary = item.querySelector("summary");
      if (!summary) return;
      var clone = item.cloneNode(true);
      var copySummary = clone.querySelector("summary");
      if (copySummary) copySummary.remove();
      var paras = clone.querySelectorAll("p, li");
      var answer = paras.length
        ? Array.prototype.map.call(paras, function (el) { return el.textContent || ""; }).join(" ")
        : clone.textContent;
      pairs.push({ q: normFaq(summary.textContent), a: normFaq(answer) });
    });
    return pairs;
  }

  function extractFaqs(html) {
    var doc = parseHtml(html);
    return faqPairsFromRoot(editableRoot(doc));
  }

  function extractFragmentFaqs(fragmentHtml) {
    var doc = parseHtml("<!DOCTYPE html><html><body>" + String(fragmentHtml || "") + "</body></html>");
    return faqPairsFromRoot(doc.body);
  }

  function sameFaqs(a, b) {
    return JSON.stringify(a || []) === JSON.stringify(b || []);
  }

  function parseLd(text) {
    try { return JSON.parse(text); }
    catch (err) { return null; }
  }

  function ldTypeName(node) {
    if (!node) return "";
    var kind = node["@type"];
    if (Array.isArray(kind)) return kind.join(" ");
    return String(kind || "");
  }

  function isFaqNode(node) {
    return ldTypeName(node).indexOf("FAQPage") !== -1;
  }

  function scriptIsFaq(text) {
    var data = parseLd(text);
    if (!data) return false;
    if (isFaqNode(data)) return true;
    return !!(data["@graph"] && Array.isArray(data["@graph"]) && data["@graph"].some(isFaqNode));
  }

  function faqQuestions(text) {
    var data = parseLd(text);
    if (!data) return [];
    var pages = [];
    if (isFaqNode(data)) pages.push(data);
    if (Array.isArray(data["@graph"])) data["@graph"].forEach(function (node) { if (isFaqNode(node)) pages.push(node); });
    var pairs = [];
    pages.forEach(function (page) {
      var list = page.mainEntity || [];
      if (!Array.isArray(list)) list = [list];
      list.forEach(function (item) {
        if (!item) return;
        var answer = item.acceptedAnswer || {};
        if (Array.isArray(answer)) answer = answer[0] || {};
        pairs.push({ q: normFaq(item.name), a: normFaq(answer.text || "") });
      });
    });
    return pairs;
  }

  function faqMainEntity(pairs) {
    return (pairs || []).map(function (pair) {
      return {
        "@type": "Question",
        name: pair.q,
        acceptedAnswer: { "@type": "Answer", text: pair.a }
      };
    });
  }

  function syncFaqScript(text, pairs) {
    var data = parseLd(text);
    if (!data) return text;
    var next = JSON.parse(JSON.stringify(data));
    if (isFaqNode(next)) {
      if (!pairs.length) return null;
      next.mainEntity = faqMainEntity(pairs);
      return JSON.stringify(next);
    }
    if (Array.isArray(next["@graph"])) {
      var graph = [];
      next["@graph"].forEach(function (node) {
        if (!isFaqNode(node)) {
          graph.push(node);
          return;
        }
        if (!pairs.length) return;
        var copy = JSON.parse(JSON.stringify(node));
        copy.mainEntity = faqMainEntity(pairs);
        graph.push(copy);
      });
      if (!graph.length) return null;
      next["@graph"] = graph;
      return JSON.stringify(next);
    }
    return text;
  }

  function replaceFaqScripts(html, pairs) {
    return String(html || "").replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, function (full, attrs, body) {
      if (!/application\/ld\+json/i.test(attrs)) return full;
      if (!scriptIsFaq(body.trim())) return full;
      var updated = syncFaqScript(body.trim(), pairs);
      if (updated == null) return "";
      return "<script" + attrs + ">" + updated + "<" + "/script>";
    });
  }

  function insertFaqScript(html, pairs) {
    if (!pairs || !pairs.length) return html;
    var block = '<script type="application/ld+json">' + JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqMainEntity(pairs)
    }) + "<" + "/script>";
    if (html.indexOf("</head>") !== -1) return html.replace("</head>", block + "</head>");
    return html + block;
  }

  function nonFaqFingerprints(texts) {
    var out = [];
    (texts || []).forEach(function (text) {
      if (!scriptIsFaq(text)) {
        out.push(String(text));
        return;
      }
      var data = parseLd(text);
      if (!data || !Array.isArray(data["@graph"])) return;
      data["@graph"].forEach(function (node) {
        if (!isFaqNode(node)) out.push(JSON.stringify(node));
      });
    });
    return out;
  }

  function faqJsonMiss(origTexts, nextTexts, origFaqs, nextFaqs) {
    if (sameFaqs(origFaqs, nextFaqs)) return missingCount(origTexts, nextTexts);
    var miss = missingCount(nonFaqFingerprints(origTexts), nonFaqFingerprints(nextTexts));
    var nextFaqTexts = (nextTexts || []).filter(scriptIsFaq);
    var origFaqTexts = (origTexts || []).filter(scriptIsFaq);
    if ((nextFaqs || []).length && origFaqTexts.length) {
      if (!nextFaqTexts.length) miss += 1;
      else {
        var got = [];
        nextFaqTexts.forEach(function (text) { got = got.concat(faqQuestions(text)); });
        if (!sameFaqs(nextFaqs, got)) miss += 1;
      }
    }
    return miss;
  }

  function nextUrlPath(urlPath, slug) {
    var raw = String(slug || "").trim().replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-").toLowerCase();
    var parts = String(urlPath || "").split("/").filter(function (part) { return part.length; });
    if (!raw) return parts.length ? "/" + parts.join("/") + "/" : "/";
    if (!parts.length) return "/" + raw + "/";
    parts[parts.length - 1] = raw;
    return "/" + parts.join("/") + "/";
  }

  function nextFilePath(filePath, oldSlug, newSlug) {
    if (!oldSlug || !newSlug || oldSlug === newSlug) return filePath;
    var parts = String(filePath || "").split("/");
    var idx = parts.indexOf(oldSlug);
    if (idx === -1) return filePath;
    parts[idx] = newSlug;
    return parts.join("/");
  }

  function uploadImagePath(articlePath, filename) {
    var dir = String(articlePath || "").split("/").slice(0, -1).filter(Boolean).join("/");
    var base = String(filename || "image").toLowerCase().replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!base) base = "image";
    return (dir ? dir + "/img/" : "img/") + base + ".webp";
  }

  function fidelityCheck(originalHtml, nextHtml, editorFragmentHtml) {
    var editorInv = fragmentInventory(editorFragmentHtml);
    var nextDoc = parseHtml(nextHtml);
    var nextRoot = editableRoot(nextDoc);
    var nextInv = inventoryElement(nextRoot);
    var origDoc = parseHtml(originalHtml);
    var bits = [];
    var imageMiss = missingCount(editorInv.images, nextInv.images);
    var captionMiss = missingCount(editorInv.captions, nextInv.captions);
    var figureMiss = missingCount(editorInv.figures, nextInv.figures);
    var tableMiss = missingCount(editorInv.tables, nextInv.tables);
    var linkMiss = missingCount(editorInv.links, nextInv.links);
    var jsonMiss = faqJsonMiss(jsonLd(origDoc), jsonLd(nextDoc), faqPairsFromRoot(editableRoot(origDoc)), faqPairsFromRoot(nextRoot));
    if (imageMiss) bits.push(phrase(imageMiss, "a photo", "photos"));
    if (captionMiss) bits.push(phrase(captionMiss, "a photo credit", "photo credits"));
    if (figureMiss && !imageMiss) bits.push(phrase(figureMiss, "a captioned photo", "captioned photos"));
    if (tableMiss) bits.push(phrase(tableMiss, "a table", "tables"));
    if (linkMiss) bits.push(phrase(linkMiss, "a link", "links"));
    if (jsonMiss) bits.push(jsonMiss === 1 ? "the hidden search summary" : "the hidden search summaries");
    var outsideOk = outsidePreserved(origDoc, nextDoc);
    if (!outsideOk) bits.push("part of the page outside the article");
    if (!bits.length) return { ok: true, message: "" };
    return {
      ok: false,
      message: "These edits were not saved. The page would have lost " + joinPhrases(bits) + ". Your draft is still here, and nothing was changed on GitHub."
    };
  }

  function outsidePreserved(origDoc, nextDoc) {
    var origRoot = editableRoot(origDoc);
    var nextRoot = editableRoot(nextDoc);
    function outside(doc, root, sel) {
      var all = Array.prototype.slice.call(doc.querySelectorAll(sel));
      return all.filter(function (el) { return !root || !root.contains(el); }).map(function (el) {
        if (el.tagName === "IMG") return el.getAttribute("src") || "";
        if (el.tagName === "A") return el.getAttribute("href") || "";
        return (el.textContent || "").trim();
      });
    }
    if (missingCount(outside(origDoc, origRoot, "img"), outside(nextDoc, nextRoot, "img"))) return false;
    if (faqJsonMiss(jsonLd(origDoc), jsonLd(nextDoc), faqPairsFromRoot(origRoot), faqPairsFromRoot(nextRoot))) return false;
    return true;
  }

  function preservesFragment(originalFragment, roundTrippedFragment) {
    var a = fragmentInventory(originalFragment);
    var b = fragmentInventory(roundTrippedFragment);
    var imageMiss = missingCount(a.images, b.images);
    var captionMiss = missingCount(a.captions, b.captions);
    var figureMiss = missingCount(a.figures, b.figures);
    var tableMiss = missingCount(a.tables, b.tables);
    var linkMiss = missingCount(a.links, b.links);
    return {
      ok: !imageMiss && !captionMiss && !figureMiss && !tableMiss && !linkMiss,
      images: imageMiss,
      captions: captionMiss,
      figures: figureMiss,
      tables: tableMiss,
      links: linkMiss
    };
  }

  function signature(el) {
    if (!el || el.nodeType === 3) {
      var text = el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
      return text ? { t: "#text", text: text } : null;
    }
    if (el.nodeType !== 1) return null;
    var attrs = {};
    Array.prototype.forEach.call(el.attributes || [], function (attr) {
      if (attr.name.indexOf("on") === 0) return;
      attrs[attr.name] = attr.value;
    });
    var kids = [];
    Array.prototype.forEach.call(el.childNodes || [], function (child) {
      var item = signature(child);
      if (item) kids.push(item);
    });
    return { t: el.tagName.toLowerCase(), attrs: attrs, kids: kids };
  }

  function fragmentSignature(html) {
    var doc = parseHtml("<!DOCTYPE html><html><body>" + String(html || "") + "</body></html>");
    var kids = [];
    Array.prototype.forEach.call(doc.body.childNodes, function (child) {
      var item = signature(child);
      if (item) kids.push(item);
    });
    return kids;
  }

  function inlinePlain(nodes) {
    var text = "";
    (nodes || []).forEach(function (node) {
      if (!node) return;
      if (node.type === "text") text += node.text;
      else if (node.type === "inlineEl") text += inlinePlain(node.content);
      else if (node.type === "hardBreak") text += "\n";
    });
    return text.replace(/\s+/g, " ").trim();
  }

  function collectTextBlocks(node, list) {
    if (!node) return;
    if (node.type === "textBlock") {
      list.push(inlinePlain(node.content));
      return;
    }
    (node.content || []).forEach(function (child) { collectTextBlocks(child, list); });
  }

  function wordsOf(text) {
    return String(text || "").match(/\s+|\S+/g) || [];
  }

  function diffTokens(a, b) {
    var n = a.length;
    var m = b.length;
    if (n * m > 400000) {
      if (a.join("") === b.join("")) return a.map(function (token) { return { op: "equal", text: token }; });
      return [{ op: "delete", text: a.join("") }, { op: "insert", text: b.join("") }];
    }
    var dp = new Array(n + 1);
    for (var i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1);
      dp[i][0] = 0;
    }
    for (var j = 0; j <= m; j++) dp[0][j] = 0;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
      }
    }
    var ops = [];
    i = n;
    j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        ops.push({ op: "equal", text: a[i - 1] });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ op: "insert", text: b[j - 1] });
        j -= 1;
      } else {
        ops.push({ op: "delete", text: a[i - 1] });
        i -= 1;
      }
    }
    ops.reverse();
    return ops;
  }

  function alignLists(a, b) {
    var pairs = diffTokens(a, b);
    return pairs;
  }

  function diffHtml(originalFragment, currentFragment) {
    var originalDoc = parseFragment(originalFragment);
    var currentDoc = parseFragment(currentFragment);
    var oldBlocks = [];
    var newBlocks = [];
    collectTextBlocks(originalDoc, oldBlocks);
    collectTextBlocks(currentDoc, newBlocks);
    var ops = alignLists(oldBlocks, newBlocks);
    var html = "";
    ops.forEach(function (op) {
      if (op.op === "equal") {
        html += '<p class="rm-same">' + escapeText(op.text) + "</p>";
        return;
      }
      if (op.op === "delete") {
        var deleted = diffTokens(wordsOf(op.text), []);
        html += '<p class="rm-del">' + escapeText(op.text) + "</p>";
        return;
      }
      var wordOps = diffTokens(wordsOf(""), wordsOf(op.text));
      html += '<p class="rm-ins">' + escapeText(op.text) + "</p>";
      void deleted;
      void wordOps;
    });
    return renderArticleDiff(originalFragment, currentFragment, oldBlocks, newBlocks);
  }

  function renderArticleDiff(originalFragment, currentFragment, oldBlocks, newBlocks) {
    var currentDoc = parseHtml("<!DOCTYPE html><html><body>" + currentFragment + "</body></html>");
    var blocks = [];
    Array.prototype.forEach.call(currentDoc.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,summary,blockquote,caption,dt,dd"), function (el) {
      if (el.querySelector("h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,table,ul,ol")) {
        if (el.tagName === "LI" || el.tagName === "TD" || el.tagName === "TH" || el.tagName === "BLOCKQUOTE") {
          if (el.querySelector("p,h2,h3,table,ul,ol")) return;
        } else if (el.tagName !== "FIGCAPTION" && el.tagName !== "SUMMARY") return;
      }
      blocks.push(el);
    });
    var oldLeft = oldBlocks.slice();
    var used = {};
    function overlap(a, b) {
      var left = wordsOf(a).filter(function (word) { return word.trim(); });
      var right = wordsOf(b).filter(function (word) { return word.trim(); });
      if (!left.length || !right.length) return 0;
      var bag = {};
      left.forEach(function (word) { bag[word] = (bag[word] || 0) + 1; });
      var hit = 0;
      right.forEach(function (word) {
        if (bag[word]) { bag[word] -= 1; hit += 1; }
      });
      return hit / Math.max(left.length, right.length);
    }
    blocks.forEach(function (el) {
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      var found = -1;
      for (var i = 0; i < oldLeft.length; i++) {
        if (used[i]) continue;
        if (oldLeft[i] === text) { found = i; break; }
      }
      if (found !== -1) {
        used[found] = true;
        return;
      }
      var best = -1;
      var score = 0;
      for (var j = 0; j < oldLeft.length; j++) {
        if (used[j]) continue;
        var next = overlap(oldLeft[j], text);
        if (next > score) { score = next; best = j; }
      }
      if (best !== -1 && score >= 0.45) {
        used[best] = true;
        decorateText(el, diffTokens(wordsOf(oldLeft[best]), wordsOf(text)));
        return;
      }
      el.classList.add("rm-ins");
    });
    var cursor = 0;
    oldBlocks.forEach(function (text, index) {
      if (used[index]) {
        cursor += 1;
        return;
      }
      var del = currentDoc.createElement("p");
      del.className = "rm-del";
      del.textContent = text;
      var anchor = blocks[cursor] || null;
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(del, anchor);
      else currentDoc.body.appendChild(del);
    });
    void newBlocks;
    return currentDoc.body.innerHTML;
  }

  function decorateText(el, ops) {
    var changed = ops.some(function (op) { return op.op !== "equal"; });
    if (!changed) return;
    var html = "";
    ops.forEach(function (op) {
      if (op.op === "equal") html += escapeText(op.text);
      else if (op.op === "insert") html += '<span class="rm-ins">' + escapeText(op.text) + "</span>";
      else html += '<span class="rm-del">' + escapeText(op.text) + "</span>";
    });
    el.innerHTML = html;
  }

  var api = {
    parseHtml: parseHtml,
    editableRoot: editableRoot,
    rootAddress: rootAddress,
    parseFragment: parseFragment,
    domToDoc: domToDoc,
    serializeDoc: serializeDoc,
    extractInner: extractInner,
    replaceInner: replaceInner,
    applyDocument: applyDocument,
    fidelityCheck: fidelityCheck,
    preservesFragment: preservesFragment,
    fragmentInventory: fragmentInventory,
    fragmentSignature: fragmentSignature,
    jsonLd: jsonLd,
    diffHtml: diffHtml,
    inlinePlain: inlinePlain,
    collectTextBlocks: collectTextBlocks,
    extractFaqs: extractFaqs,
    extractFragmentFaqs: extractFragmentFaqs,
    nextUrlPath: nextUrlPath,
    nextFilePath: nextFilePath,
    uploadImagePath: uploadImagePath
  };

  root.RMRoundtrip = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
