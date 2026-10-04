(function (root) {
  var PM = root.RMProseMirror;
  if (!PM) throw new Error("ProseMirror is not loaded");

  var Schema = PM.Schema;
  var EditorState = PM.EditorState;
  var EditorView = PM.EditorView;
  var Plugin = PM.Plugin;
  var PluginKey = PM.PluginKey;
  var TextSelection = PM.TextSelection;
  var Decoration = PM.Decoration;
  var DecorationSet = PM.DecorationSet;
  var Slice = PM.Slice;
  var Fragment = PM.Fragment;
  var history = PM.history;
  var keymap = PM.keymap;
  var baseKeymap = PM.baseKeymap;
  var toggleMark = PM.toggleMark;
  var chainCommands = PM.chainCommands;
  var newlineInCode = PM.newlineInCode;
  var createParagraphNear = PM.createParagraphNear;
  var liftEmptyBlock = PM.liftEmptyBlock;
  var splitBlock = PM.splitBlock;
  var undo = PM.undo;
  var redo = PM.redo;
  var gapCursor = PM.gapCursor;

  var BLOCK_TAGS = {
    address: 1, article: 1, aside: 1, blockquote: 1, div: 1, dl: 1, fieldset: 1,
    figcaption: 1, figure: 1, footer: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
    header: 1, hr: 1, li: 1, main: 1, ol: 1, p: 1, pre: 1, section: 1, table: 1,
    ul: 1, details: 1, summary: 1, hgroup: 1, dd: 1, dt: 1, thead: 1, tbody: 1,
    tfoot: 1, tr: 1, td: 1, th: 1, caption: 1, colgroup: 1, nav: 1, center: 1,
    dialog: 1, picture: 1
  };
  var OPAQUE_TAGS = {
    script: 1, style: 1, svg: 1, form: 1, iframe: 1, canvas: 1, noscript: 1,
    object: 1, embed: 1, video: 1, audio: 1, math: 1, template: 1, textarea: 1,
    select: 1, input: 1
  };
  var VOID_TAGS = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1,
    meta: 1, param: 1, source: 1, track: 1, wbr: 1
  };
  var FORMAT_MARKS = {
    strong: "strong", b: "b", em: "em", i: "i", u: "underline", s: "strike",
    strike: "strike", del: "strike", code: "code", sub: "sub", sup: "sup", a: "link"
  };
  var MARK_TAGS = {
    strong: "strong", b: "b", em: "em", i: "i", underline: "u", strike: "s",
    code: "code", sub: "sub", sup: "sup", link: "a"
  };
  var LISTABLE = { p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 };
  var HIDDEN_OPAQUE = { script: 1, style: 1, noscript: 1, template: 1, iframe: 1, object: 1, embed: 1 };

  var schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      text: { group: "inline" },
      textblock: {
        content: "inline*",
        group: "block",
        defining: true,
        attrs: {
          tag: { default: "p" },
          html: { default: {} },
          synthetic: { default: false }
        },
        toDOM: function (node) {
          var tag = node.attrs.synthetic ? "span" : safeTag(node.attrs.tag);
          var attrs = node.attrs.synthetic ? { "data-rm-syn": "1" } : displayAttrs(node.attrs.html);
          return [tag, attrs, 0];
        }
      },
      element: {
        content: "block*",
        group: "block",
        defining: true,
        attrs: {
          tag: { default: "div" },
          html: { default: {} },
          synthetic: { default: false }
        },
        toDOM: function (node) {
          var tag = node.attrs.synthetic ? "div" : safeTag(node.attrs.tag);
          var attrs = node.attrs.synthetic ? { "data-rm-syn": "1" } : displayAttrs(node.attrs.html);
          return [tag, attrs, 0];
        }
      },
      opaque: {
        group: "block",
        atom: true,
        attrs: {
          tag: { default: "div" },
          html: { default: "" },
          preview: { default: "" }
        },
        toDOM: function () {
          return ["div", { "data-rm-hold": "1", contenteditable: "false" }];
        }
      },
      image_block: {
        group: "block",
        atom: true,
        draggable: false,
        attrs: { html: { default: {} } },
        toDOM: function (node) { return ["img", displayAttrs(node.attrs.html)]; }
      },
      image_inline: {
        inline: true,
        group: "inline",
        atom: true,
        draggable: false,
        attrs: { html: { default: {} } },
        toDOM: function (node) { return ["img", displayAttrs(node.attrs.html)]; }
      },
      void_block: {
        group: "block",
        atom: true,
        attrs: { tag: { default: "hr" }, html: { default: {} } },
        toDOM: function (node) { return [safeTag(node.attrs.tag), displayAttrs(node.attrs.html)]; }
      },
      void_inline: {
        inline: true,
        group: "inline",
        atom: true,
        attrs: { tag: { default: "span" }, html: { default: {} } },
        toDOM: function (node) { return [safeTag(node.attrs.tag), displayAttrs(node.attrs.html)]; }
      },
      hard_break: {
        inline: true,
        group: "inline",
        atom: true,
        selectable: false,
        toDOM: function () { return ["br"]; }
      },
      inline_el: {
        inline: true,
        group: "inline",
        content: "inline*",
        attrs: { tag: { default: "span" }, html: { default: {} } },
        toDOM: function (node) {
          return [safeTag(node.attrs.tag), displayAttrs(node.attrs.html), 0];
        }
      }
    },
    marks: {
      link: {
        inclusive: false,
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["a", displayAttrs(mark.attrs.html)]; }
      },
      strong: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["strong", displayAttrs(mark.attrs.html)]; }
      },
      b: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["b", displayAttrs(mark.attrs.html)]; }
      },
      em: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["em", displayAttrs(mark.attrs.html)]; }
      },
      i: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["i", displayAttrs(mark.attrs.html)]; }
      },
      underline: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["u", displayAttrs(mark.attrs.html)]; }
      },
      strike: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["s", displayAttrs(mark.attrs.html)]; }
      },
      code: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["code", displayAttrs(mark.attrs.html)]; }
      },
      sub: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["sub", displayAttrs(mark.attrs.html)]; }
      },
      sup: {
        attrs: { html: { default: {} } },
        toDOM: function (mark) { return ["sup", displayAttrs(mark.attrs.html)]; }
      }
    }
  });

  function safeTag(tag) {
    var name = String(tag || "").toLowerCase();
    if (!/^[a-z][a-z0-9:-]*$/.test(name)) return "div";
    if (name === "script" || name === "style" || name === "iframe" || name === "object" || name === "embed") return "div";
    return name;
  }

  function displayAttrs(html) {
    var out = {};
    var source = html || {};
    Object.keys(source).forEach(function (name) {
      var value = source[name];
      if (value == null) return;
      if (/^on[a-z]/.test(name)) return;
      if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(String(value))) return;
      out[name] = String(value);
    });
    return out;
  }

  function tagOf(el) {
    return el.tagName ? el.tagName.toLowerCase() : "";
  }

  function isElement(node) {
    return !!(node && node.nodeType === 1);
  }

  function readHtmlAttrs(el) {
    var html = {};
    var attrs = el.attributes || [];
    for (var i = 0; i < attrs.length; i++) {
      var name = String(attrs[i].name || "").toLowerCase();
      if (!name || name === "contenteditable") continue;
      if (/^on[a-z]/.test(name)) continue;
      html[name] = attrs[i].value;
    }
    return html;
  }

  function childArray(el) {
    return Array.prototype.slice.call(el.childNodes || []);
  }

  function isOpaqueTag(tag) {
    return !!OPAQUE_TAGS[tag];
  }

  function outermostOpaque(el, rootEl) {
    var top = null;
    var cur = el;
    while (cur && cur !== rootEl) {
      if (isElement(cur) && isOpaqueTag(tagOf(cur))) top = cur;
      cur = cur.parentElement;
    }
    return top;
  }

  function captureOpaque(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    var nodes = rootEl.querySelectorAll("script, style, svg, form, iframe, canvas, noscript, object, embed, video, audio, math, template, textarea, select, input");
    Array.prototype.forEach.call(nodes, function (el) {
      if (outermostOpaque(el, rootEl) !== el) return;
      if (!el.__rmHtml) el.__rmHtml = el.outerHTML;
    });
  }

  function hasBlockDescendant(el) {
    var kids = el.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (!isElement(node)) continue;
      var tag = tagOf(node);
      if (tag === "br" || tag === "img" || tag === "wbr") continue;
      if (isOpaqueTag(tag) || BLOCK_TAGS[tag] || tag === "hr") return true;
      if (hasBlockDescendant(node)) return true;
    }
    return false;
  }

  function isBlockishChild(node) {
    if (!isElement(node)) return false;
    var tag = tagOf(node);
    if (tag === "br" || tag === "img" || tag === "wbr") return false;
    if (isOpaqueTag(tag) || BLOCK_TAGS[tag] || tag === "hr") return true;
    return hasBlockDescendant(node);
  }

  function collapseWs(text, pre) {
    var value = String(text || "");
    if (pre) return value;
    return value.replace(/\u00a0/g, "\uE000").replace(/\s+/g, " ").replace(/\uE000/g, "\u00a0");
  }

  function trimEdgeText(nodes) {
    if (!nodes.length) return nodes;
    var first = nodes[0];
    if (first.isText) {
      var start = first.text.replace(/^[ \t\n\r\f]+/, "");
      if (!start) nodes.shift();
      else if (start !== first.text) nodes[0] = first.mark ? schema.text(start, first.marks) : schema.text(start);
    }
    if (!nodes.length) return nodes;
    var last = nodes[nodes.length - 1];
    if (last.isText) {
      var end = last.text.replace(/[ \t\n\r\f]+$/, "");
      if (!end) nodes.pop();
      else if (end !== last.text) nodes[nodes.length - 1] = schema.text(end, last.marks);
    }
    return nodes;
  }

  function isFlatFormatting(el) {
    var kids = el.childNodes || [];
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (!isElement(node)) continue;
      var tag = tagOf(node);
      if (tag === "br") continue;
      if (!FORMAT_MARKS[tag]) return false;
      if (!isFlatFormatting(node)) return false;
    }
    return true;
  }

  function isEmptyInline(el) {
    if (el.querySelector && el.querySelector("*")) return false;
    return !String(el.textContent || "").replace(/[ \t\n\r\f]+/g, "").length;
  }

  function imageNode(el, inline) {
    var type = inline ? schema.nodes.image_inline : schema.nodes.image_block;
    return type.create({ html: readHtmlAttrs(el) });
  }

  function parseOpaque(el) {
    var tag = tagOf(el);
    var original = el.__rmHtml || el.outerHTML;
    var preview = "";
    if (!HIDDEN_OPAQUE[tag]) preview = stripHandlers(el.outerHTML);
    return schema.nodes.opaque.create({ tag: tag, html: original, preview: preview });
  }

  function stripHandlers(html) {
    return String(html || "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }

  function parseInlineList(nodes, pre) {
    var out = [];
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        var text = collapseWs(node.textContent, pre);
        if (!text) return;
        out.push(schema.text(text));
        return;
      }
      if (!isElement(node)) return;
      parseInlineElement(node, pre).forEach(function (child) {
        if (child) out.push(child);
      });
    });
    if (!pre) trimEdgeText(out);
    return out.filter(Boolean);
  }

  function parseInlineElement(el, pre) {
    var tag = tagOf(el);
    if (tag === "br") return [schema.nodes.hard_break.create()];
    if (tag === "img") return [imageNode(el, true)];
    if (VOID_TAGS[tag]) return [schema.nodes.void_inline.create({ tag: tag, html: readHtmlAttrs(el) })];
    if (isOpaqueTag(tag)) return [parseOpaque(el)];
    var markName = FORMAT_MARKS[tag];
    if (markName && isFlatFormatting(el)) {
      var mark = schema.marks[markName].create({ html: readHtmlAttrs(el) });
      var inner = parseInlineList(childArray(el), pre);
      if (!inner.length) return [];
      return inner.map(function (node) {
        return node.mark(mark.addToSet(node.marks));
      });
    }
    if (isEmptyInline(el)) return [schema.nodes.void_inline.create({ tag: tag, html: readHtmlAttrs(el) })];
    var content = parseInlineList(childArray(el), pre);
    return [schema.nodes.inline_el.create({ tag: tag, html: readHtmlAttrs(el) }, content)];
  }

  function parseFlow(el) {
    var blocks = [];
    var buffer = [];
    function flush() {
      var items = buffer.filter(function (node) {
        if (node.nodeType === 3 && !String(node.textContent || "").replace(/\s+/g, "").length) return false;
        return node.nodeType === 3 || isElement(node);
      });
      buffer = [];
      if (!items.length) return;
      if (items.length === 1 && isElement(items[0])) {
        var only = items[0];
        var tag = tagOf(only);
        if (tag === "img") {
          blocks.push(imageNode(only, false));
          return;
        }
        if (tag === "br") {
          blocks.push(schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: true }, schema.nodes.hard_break.create()));
          return;
        }
        blocks.push(parseBlock(only));
        return;
      }
      var inline = parseInlineList(items, false);
      if (!inline.length) return;
      blocks.push(schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: true }, inline));
    }
    childArray(el).forEach(function (node) {
      if (node.nodeType === 8 || node.nodeType === 7) return;
      if (isBlockishChild(node)) {
        flush();
        blocks.push(parseBlock(node));
        return;
      }
      if (node.nodeType === 3 || isElement(node)) buffer.push(node);
    });
    flush();
    return blocks;
  }

  function parseBlock(el) {
    try {
      return parseBlockInner(el);
    } catch (err) {
      return parseOpaque(el);
    }
  }

  function parseBlockInner(el) {
    var tag = tagOf(el);
    if (isOpaqueTag(tag)) return parseOpaque(el);
    if (tag === "img") return imageNode(el, false);
    if (tag === "hr" || (VOID_TAGS[tag] && tag !== "br" && tag !== "img")) {
      return schema.nodes.void_block.create({ tag: tag, html: readHtmlAttrs(el) });
    }
    var html = readHtmlAttrs(el);
    var pre = tag === "pre";
    if (!hasBlockDescendant(el) && !childArray(el).some(isBlockishChild)) {
      return schema.nodes.textblock.create({ tag: tag, html: html, synthetic: false }, parseInlineList(childArray(el), pre));
    }
    return schema.nodes.element.create({ tag: tag, html: html, synthetic: false }, parseFlow(el));
  }

  function parseRoot(el) {
    var blocks = parseFlow(el);
    if (!blocks.length) blocks.push(schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: false }));
    var doc = schema.nodes.doc.create(null, blocks);
    doc.check();
    return doc;
  }

  function attrsString(html, forSave) {
    var source = html || {};
    var origSrc = source["data-rm-orig-src"];
    var origSrcset = source["data-rm-orig-srcset"];
    var out = "";
    Object.keys(source).forEach(function (name) {
      if (!name || name === "contenteditable" || /^on[a-z]/.test(name)) return;
      if (forSave && name.indexOf("data-rm-") === 0) return;
      var value = source[name];
      if (value == null) return;
      if (forSave && name === "src" && origSrc) value = origSrc;
      if (forSave && name === "srcset" && origSrcset) value = origSrcset;
      if (forSave && /^blob:/i.test(String(value))) return;
      if (forSave && (name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(String(value))) return;
      out += " " + name + "=\"" + escapeAttr(value) + "\"";
    });
    return out;
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function escapeText(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderMarks(marks, inner) {
    var sorted = (marks || []).slice().sort(function (a, b) { return a.type.rank - b.type.rank; });
    var html = inner;
    for (var i = sorted.length - 1; i >= 0; i--) {
      var mark = sorted[i];
      var tag = MARK_TAGS[mark.type.name] || "span";
      html = "<" + tag + attrsString(mark.attrs.html, true) + ">" + html + "</" + tag + ">";
    }
    return html;
  }

  function serializeImg(node) {
    return "<img" + attrsString(node.attrs.html, true) + ">";
  }

  function serializeVoid(node) {
    var tag = safeTag(node.attrs.tag);
    var attrs = attrsString(node.attrs.html, true);
    if (VOID_TAGS[tag]) return "<" + tag + attrs + ">";
    return "<" + tag + attrs + "></" + tag + ">";
  }

  function serializeInlines(parent) {
    var out = "";
    parent.forEach(function (node) {
      if (node.isText) {
        out += renderMarks(node.marks, escapeText(node.text));
        return;
      }
      if (node.type.name === "hard_break") {
        out += renderMarks(node.marks, "<br>");
        return;
      }
      if (node.type.name === "image_inline") {
        out += renderMarks(node.marks, serializeImg(node));
        return;
      }
      if (node.type.name === "void_inline") {
        out += renderMarks(node.marks, serializeVoid(node));
        return;
      }
      if (node.type.name === "inline_el") {
        var inner = serializeInlines(node);
        var tag = safeTag(node.attrs.tag);
        out += renderMarks(node.marks, "<" + tag + attrsString(node.attrs.html, true) + ">" + inner + "</" + tag + ">");
        return;
      }
      if (node.type.name === "opaque") out += node.attrs.html || "";
    });
    return out;
  }

  function serializeBlock(node) {
    if (node.type.name === "textblock") {
      var inner = serializeInlines(node);
      if (node.attrs.synthetic) return inner;
      var tag = safeTag(node.attrs.tag);
      return "<" + tag + attrsString(node.attrs.html, true) + ">" + inner + "</" + tag + ">";
    }
    if (node.type.name === "element") {
      var children = "";
      node.forEach(function (child) { children += serializeBlock(child); });
      if (node.attrs.synthetic) return children;
      var wrap = safeTag(node.attrs.tag);
      return "<" + wrap + attrsString(node.attrs.html, true) + ">" + children + "</" + wrap + ">";
    }
    if (node.type.name === "opaque") return node.attrs.html || "";
    if (node.type.name === "image_block") return serializeImg(node);
    if (node.type.name === "void_block") return serializeVoid(node);
    return "";
  }

  function serialize(doc) {
    var parts = [];
    doc.forEach(function (child) { parts.push(serializeBlock(child)); });
    return parts.join("\n");
  }

  function indexDoc(doc) {
    var text = "";
    var spans = [];
    var first = true;
    var blockSep = "\n";
    doc.nodesBetween(0, doc.content.size, function (node, pos) {
      var nodeText = "";
      if (node.isText) nodeText = node.text;
      else if (node.isLeaf && node.type.spec.leafText) nodeText = node.type.spec.leafText(node) || "";
      if (node.isBlock && ((node.isLeaf && nodeText) || node.isTextblock)) {
        if (first) first = false;
        else {
          spans.push({ start: text.length, end: text.length + blockSep.length, from: pos, gap: true });
          text += blockSep;
        }
      }
      if (node.isText && nodeText) {
        spans.push({ start: text.length, end: text.length + nodeText.length, from: pos, to: pos + node.nodeSize });
        text += nodeText;
      }
    });
    return { text: text, spans: spans };
  }

  function plainText(doc) {
    return indexDoc(doc).text;
  }

  function textIndexAt(indexed, pos) {
    var spans = indexed.spans;
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      if (span.gap) {
        if (pos <= span.from) return span.start;
        continue;
      }
      if (pos < span.from) return span.start;
      if (pos <= span.to) return span.start + (pos - span.from);
    }
    return indexed.text.length;
  }

  function pmRanges(spans, start, end) {
    var out = [];
    spans.forEach(function (span) {
      if (span.gap) return;
      var fromIndex = Math.max(span.start, start);
      var toIndex = Math.min(span.end, end);
      if (toIndex > fromIndex) {
        out.push({
          from: span.from + (fromIndex - span.start),
          to: span.from + (toIndex - span.start)
        });
      }
    });
    return out;
  }

  function posAtIndex(indexed, index, doc) {
    var spans = indexed.spans;
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      if (index < span.start) return span.from;
      if (span.gap) {
        if (index <= span.end) return span.from;
        continue;
      }
      if (index <= span.end) return span.from + Math.max(0, index - span.start);
    }
    return doc.content.size;
  }

  function buildDiffDecorations(doc, originalPlain) {
    var indexed = indexDoc(doc);
    var ops = root.RMLib.diffWords(originalPlain || "", indexed.text);
    var cursor = 0;
    var decorations = [];
    ops.forEach(function (op) {
      if (op.op === "equal") {
        cursor += op.text.length;
        return;
      }
      if (!String(op.text || "").replace(/\s+/g, "").length) {
        if (op.op === "insert") cursor += op.text.length;
        return;
      }
      if (op.op === "insert") {
        pmRanges(indexed.spans, cursor, cursor + op.text.length).forEach(function (range) {
          decorations.push(Decoration.inline(range.from, range.to, { class: "rm-ins" }));
        });
        cursor += op.text.length;
        return;
      }
      var at = posAtIndex(indexed, cursor, doc);
      decorations.push(Decoration.widget(at, function (view) {
        var span = view.dom.ownerDocument.createElement("span");
        span.className = "rm-del";
        span.setAttribute("contenteditable", "false");
        span.textContent = op.text;
        return span;
      }, { side: -1, ignoreSelection: true }));
    });
    return DecorationSet.create(doc, decorations);
  }

  function buildCommentDecorations(doc, comments) {
    var indexed = indexDoc(doc);
    var decorations = [];
    (comments || []).forEach(function (comment) {
      var quote = String(comment && comment.quote || "");
      if (!quote) return;
      var at = indexed.text.indexOf(quote);
      if (comment.hint != null && indexed.text.slice(comment.hint, comment.hint + quote.length) === quote) at = comment.hint;
      if (at < 0) return;
      pmRanges(indexed.spans, at, at + quote.length).forEach(function (range) {
        decorations.push(Decoration.inline(range.from, range.to, { class: "rm-note" }));
      });
    });
    return DecorationSet.create(doc, decorations);
  }

  function selectedQuote(state) {
    var sel = state.selection;
    if (!sel || sel.empty) return null;
    var indexed = indexDoc(state.doc);
    var start = textIndexAt(indexed, sel.from);
    var end = textIndexAt(indexed, sel.to);
    if (end <= start) return null;
    var quote = indexed.text.slice(start, end);
    if (!quote.replace(/\s+/g, "").length) return null;
    return { quote: quote, hint: start };
  }

  function markActive(state, type) {
    if (!type) return false;
    var sel = state.selection;
    if (sel.empty) return !!type.isInSet(state.storedMarks || sel.$from.marks());
    return state.doc.rangeHasMark(sel.from, sel.to, type);
  }

  function toggleEither(primary, secondary) {
    return function (state, dispatch) {
      var first = schema.marks[primary];
      var second = secondary ? schema.marks[secondary] : null;
      var on = markActive(state, first) || markActive(state, second);
      if (!on) return toggleMark(first)(state, dispatch);
      if (!dispatch) return true;
      var tr = state.tr;
      if (state.selection.empty) {
        var marks = (state.storedMarks || state.selection.$from.marks()).filter(function (mark) {
          return mark.type !== first && mark.type !== second;
        });
        tr = tr.setStoredMarks(marks);
      } else {
        tr = tr.removeMark(state.selection.from, state.selection.to, first);
        if (second) tr = tr.removeMark(state.selection.from, state.selection.to, second);
      }
      dispatch(tr);
      return true;
    };
  }

  function textblockDepth($from) {
    for (var depth = $from.depth; depth > 0; depth--) {
      if ($from.node(depth).type.name === "textblock") return depth;
    }
    return null;
  }

  function setHeading(level) {
    return function (state, dispatch) {
      var tag = "h" + level;
      var depth = textblockDepth(state.selection.$from);
      if (depth == null) return false;
      var node = state.selection.$from.node(depth);
      if (!/^(p|h[1-6])$/.test(node.attrs.tag)) return false;
      var next = node.attrs.tag === tag ? "p" : tag;
      if (node.attrs.tag === "h1" && tag !== "h1") next = tag;
      if (!dispatch) return true;
      dispatch(state.tr.setNodeMarkup(state.selection.$from.before(depth), null, {
        tag: next,
        html: node.attrs.html || {},
        synthetic: false
      }).scrollIntoView());
      return true;
    };
  }

  function toggleList(listTag) {
    return function (state, dispatch) {
      var $from = state.selection.$from;
      for (var depth = $from.depth; depth > 0; depth--) {
        var node = $from.node(depth);
        if (node.type.name === "textblock" && node.attrs.tag === "li") {
          var list = $from.node(depth - 1);
          if (!list || list.type.name !== "element") break;
          if (list.attrs.tag !== "ul" && list.attrs.tag !== "ol") break;
          if (!dispatch) return true;
          if (list.attrs.tag === listTag) unwrapLi(state, dispatch, $from, depth);
          else {
            dispatch(state.tr.setNodeMarkup($from.before(depth - 1), null, {
              tag: listTag,
              html: list.attrs.html || {},
              synthetic: false
            }).scrollIntoView());
          }
          return true;
        }
      }
      var blockDepth = textblockDepth($from);
      if (blockDepth == null) return false;
      var block = $from.node(blockDepth);
      if (!LISTABLE[block.attrs.tag]) return false;
      if (!dispatch) return true;
      var li = schema.nodes.textblock.create({ tag: "li", html: {}, synthetic: false }, block.content);
      var list = schema.nodes.element.create({ tag: listTag, html: {}, synthetic: false }, li);
      dispatch(state.tr.replaceWith($from.before(blockDepth), $from.after(blockDepth), list).scrollIntoView());
      return true;
    };
  }

  function unwrapLi(state, dispatch, $from, liDepth) {
    var li = $from.node(liDepth);
    var list = $from.node(liDepth - 1);
    var paragraph = schema.nodes.textblock.create({
      tag: "p",
      html: li.attrs.html || {},
      synthetic: false
    }, li.content);
    if (list.childCount === 1) {
      dispatch(state.tr.replaceWith($from.before(liDepth - 1), $from.after(liDepth - 1), paragraph).scrollIntoView());
      return;
    }
    var index = $from.index(liDepth - 1);
    var before = [];
    var after = [];
    list.forEach(function (child, offset, childIndex) {
      if (childIndex < index) before.push(child);
      else if (childIndex > index) after.push(child);
    });
    var nodes = [];
    if (before.length) nodes.push(schema.nodes.element.create(list.attrs, before));
    nodes.push(paragraph);
    if (after.length) nodes.push(schema.nodes.element.create(list.attrs, after));
    dispatch(state.tr.replaceWith($from.before(liDepth - 1), $from.after(liDepth - 1), nodes).scrollIntoView());
  }

  function clearFormatting(state, dispatch) {
    if (!dispatch) return true;
    var tr = state.tr;
    if (state.selection.empty) {
      dispatch(tr.setStoredMarks([]));
      return true;
    }
    var from = state.selection.from;
    var to = state.selection.to;
    Object.keys(MARK_TAGS).forEach(function (name) {
      if (schema.marks[name]) tr = tr.removeMark(from, to, schema.marks[name]);
    });
    state.doc.nodesBetween(from, to, function (node, pos) {
      if (node.type.name === "textblock" && /^h[2-6]$/.test(node.attrs.tag)) {
        tr = tr.setNodeMarkup(pos, null, { tag: "p", html: node.attrs.html || {}, synthetic: false });
      }
    });
    dispatch(tr);
    return true;
  }

  function enterAtEndOfHeading(state, dispatch) {
    var sel = state.selection;
    if (!sel.empty) return false;
    var parent = sel.$from.parent;
    if (parent.type.name !== "textblock" || !/^h[1-6]$/.test(parent.attrs.tag)) return false;
    if (sel.$from.parentOffset !== parent.content.size) return false;
    var paragraph = schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: false });
    if (dispatch) {
      var pos = sel.$from.after();
      var tr = state.tr.insert(pos, paragraph);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView());
    }
    return true;
  }

  function exitEmptyListItem(state, dispatch) {
    var sel = state.selection;
    if (!sel.empty) return false;
    var parent = sel.$from.parent;
    if (parent.type.name !== "textblock" || parent.attrs.tag !== "li" || parent.content.size) return false;
    if (sel.$from.depth < 2) return false;
    var list = sel.$from.node(sel.$from.depth - 1);
    if (list.type.name !== "element" || (list.attrs.tag !== "ul" && list.attrs.tag !== "ol")) return false;
    if (!dispatch) return true;
    if (list.childCount === 1) {
      var paragraph = schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: false });
      var from = sel.$from.before(sel.$from.depth - 1);
      var tr = state.tr.replaceWith(from, sel.$from.after(sel.$from.depth - 1), paragraph);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1)).scrollIntoView());
      return true;
    }
    dispatch(state.tr.delete(sel.$from.before(), sel.$from.after()).scrollIntoView());
    return true;
  }

  function parentAnchor(state) {
    var $from = state.selection.$from;
    for (var depth = $from.depth; depth > 0; depth--) {
      var node = $from.node(depth);
      if ((node.type.name === "textblock" || node.type.name === "inline_el") && node.attrs.tag === "a") {
        return { depth: depth, node: node };
      }
    }
    return null;
  }

  function getActiveLink(state) {
    var type = schema.marks.link;
    var sel = state.selection;
    var direct = type.isInSet(sel.$from.marks()) || (state.storedMarks && type.isInSet(state.storedMarks));
    if (!direct && !sel.empty) direct = type.isInSet(state.doc.resolve(Math.min(sel.to, sel.from + 1)).marks());
    if (direct) return { kind: "mark", html: direct.attrs.html || {} };
    var anchor = parentAnchor(state);
    if (anchor) return { kind: "node", html: anchor.node.attrs.html || {}, anchor: anchor };
    return null;
  }

  function linkHtml(href, newTab, previous) {
    var html = Object.assign({}, previous || {});
    html.href = href;
    if (newTab) {
      html.target = "_blank";
      html.rel = "noopener noreferrer";
    } else {
      delete html.target;
      if (html.rel === "noopener noreferrer" || html.rel === "noopener") delete html.rel;
    }
    return html;
  }

  function applyLink(view, href, newTab) {
    var clean = String(href || "").trim();
    if (!clean || /^\s*javascript:/i.test(clean)) return false;
    var state = view.state;
    var active = getActiveLink(state);
    if (active && active.kind === "node") {
      var anchor = active.anchor;
      var tr = state.tr.setNodeMarkup(state.selection.$from.before(anchor.depth), null, {
        tag: "a",
        html: linkHtml(clean, newTab, anchor.node.attrs.html),
        synthetic: !!anchor.node.attrs.synthetic
      });
      view.dispatch(tr);
      return true;
    }
    var mark = schema.marks.link.create({ html: linkHtml(clean, newTab, active && active.kind === "mark" ? active.html : {}) });
    var tr = state.tr;
    if (state.selection.empty) tr = tr.addStoredMark(mark);
    else {
      tr = tr.removeMark(state.selection.from, state.selection.to, schema.marks.link);
      tr = tr.addMark(state.selection.from, state.selection.to, mark);
    }
    view.dispatch(tr);
    return true;
  }

  function expandedMarkRange(state) {
    var type = schema.marks.link;
    var $pos = state.selection.$from;
    if (!type.isInSet($pos.marks()) && state.selection.empty) return null;
    var parent = $pos.parent;
    var start = $pos.start();
    var pos = start;
    var from = null;
    var to = null;
    var seen = false;
    parent.forEach(function (node) {
      var end = pos + node.nodeSize;
      var has = !!type.isInSet(node.marks);
      var hits = has && pos < state.selection.to && end > state.selection.from;
      if (state.selection.empty) hits = has && pos <= $pos.pos && $pos.pos <= end;
      if (hits || (seen && has && from != null && pos === to)) {
        if (from == null) from = pos;
        to = end;
        seen = true;
      } else if (seen && !has) {
        seen = false;
      }
      pos = end;
    });
    if (from == null) return null;
    return { from: from, to: to };
  }

  function removeLink(view) {
    var state = view.state;
    var active = getActiveLink(state);
    if (active && active.kind === "node") {
      var anchor = active.anchor;
      var replacement;
      if (anchor.node.type.name === "inline_el") {
        replacement = anchor.node.content;
        view.dispatch(state.tr.replaceWith(state.selection.$from.before(anchor.depth), state.selection.$from.after(anchor.depth), replacement));
        return true;
      }
      view.dispatch(state.tr.setNodeMarkup(state.selection.$from.before(anchor.depth), null, {
        tag: "p",
        html: withoutHref(anchor.node.attrs.html),
        synthetic: false
      }));
      return true;
    }
    var range = expandedMarkRange(state) || (!state.selection.empty ? state.selection : null);
    if (!range) {
      view.dispatch(state.tr.removeStoredMark(schema.marks.link));
      return true;
    }
    view.dispatch(state.tr.removeMark(range.from, range.to, schema.marks.link));
    return true;
  }

  function withoutHref(html) {
    var next = Object.assign({}, html || {});
    delete next.href;
    delete next.target;
    if (next.rel === "noopener noreferrer" || next.rel === "noopener") delete next.rel;
    return next;
  }

  function findFirst(doc, pred) {
    var found = null;
    doc.descendants(function (node, pos) {
      if (found) return false;
      if (pred(node)) {
        found = { node: node, pos: pos };
        return false;
      }
    });
    return found;
  }

  function getTitle(doc) {
    var found = findFirst(doc, function (node) {
      return node.type.name === "textblock" && node.attrs.tag === "h1";
    });
    if (!found) return "";
    return found.node.textContent.replace(/\s+/g, " ").trim();
  }

  function setTitle(view, text) {
    var value = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    var found = findFirst(view.state.doc, function (node) {
      return node.type.name === "textblock" && node.attrs.tag === "h1";
    });
    if (!found) return false;
    if (found.node.textContent.replace(/\s+/g, " ").trim() === value) return false;
    var from = found.pos + 1;
    var to = found.pos + found.node.nodeSize - 1;
    var content = value ? Fragment.from(schema.text(value)) : Fragment.empty;
    view.dispatch(view.state.tr.replaceWith(from, to, content));
    return true;
  }

  function collectImages(doc) {
    var out = [];
    doc.descendants(function (node, pos) {
      if (node.type.name !== "image_inline" && node.type.name !== "image_block") return;
      var html = node.attrs.html || {};
      var src = html["data-rm-orig-src"] || html.src || "";
      out.push({
        pos: pos,
        alt: html.alt || "",
        src: src,
        label: imageLabel(src, out.length)
      });
    });
    return out;
  }

  function imageLabel(src, index) {
    var clean = String(src || "").split("?")[0].split("#")[0].split("/").pop();
    try { clean = decodeURIComponent(clean); } catch (err) { /* keep raw */ }
    return clean ? ("Image " + (index + 1) + ", " + clean) : ("Image " + (index + 1));
  }

  function setAlt(view, index, alt) {
    var images = collectImages(view.state.doc);
    var item = images[index];
    if (!item) return false;
    var node = view.state.doc.nodeAt(item.pos);
    if (!node) return false;
    var html = Object.assign({}, node.attrs.html, { alt: alt });
    view.dispatch(view.state.tr.setNodeMarkup(item.pos, null, { html: html }));
    return true;
  }

  function insertBlocks(view, blocks) {
    if (!blocks.length) return;
    var sel = view.state.selection;
    if (blocks.length === 1 && blocks[0].type.name === "textblock" && sel.$from.parent.type.name === "textblock") {
      view.dispatch(view.state.tr.replaceSelection(new Slice(blocks[0].content, 0, 0)));
      return;
    }
    view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.from(blocks), 0, 0)));
  }

  function handlePaste(view, event) {
    var data = event.clipboardData;
    if (!data) return false;
    var html = data.getData("text/html");
    var text = data.getData("text/plain");
    if (html) {
      var parsed = new DOMParser().parseFromString(html, "text/html");
      var blocks = parseFlow(parsed.body);
      if (blocks.length) {
        insertBlocks(view, blocks);
        return true;
      }
    }
    if (text) {
      var lines = String(text).replace(/\r\n/g, "\n").split("\n");
      if (lines.length === 1) {
        view.dispatch(view.state.tr.insertText(text));
        return true;
      }
      var blocks = lines.map(function (line) {
        return schema.nodes.textblock.create({ tag: "p", html: {}, synthetic: false }, line ? schema.text(line) : null);
      });
      insertBlocks(view, blocks);
      return true;
    }
    return false;
  }

  function buildKeys() {
    var keys = {};
    keys["Mod-b"] = toggleEither("strong", "b");
    keys["Mod-i"] = toggleEither("em", "i");
    keys["Mod-u"] = toggleMark(schema.marks.underline);
    keys["Mod-z"] = undo;
    keys["Mod-y"] = redo;
    keys["Mod-Shift-z"] = redo;
    keys["Shift-Mod-z"] = redo;
    keys.Enter = chainCommands(exitEmptyListItem, enterAtEndOfHeading, newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock);
    return keys;
  }

  function opaqueView(node, view) {
    var doc = view.dom.ownerDocument;
    var dom = doc.createElement("div");
    dom.className = "rm-hold";
    dom.setAttribute("contenteditable", "false");
    dom.setAttribute("data-rm-hold", node.attrs.tag || "div");
    if (node.attrs.preview) dom.innerHTML = node.attrs.preview;
    else dom.hidden = true;
    return {
      dom: dom,
      ignoreMutation: function () { return true; },
      stopEvent: function () { return true; }
    };
  }

  function createEditor(mount, doc, options) {
    options = options || {};
    var diffOn = false;
    var diffKey = new PluginKey("rm-diff");
    var commentKey = new PluginKey("rm-comments");
    var state = EditorState.create({
      doc: doc,
      plugins: [
        history({ depth: 200 }),
        keymap(buildKeys()),
        keymap(baseKeymap),
        gapCursor(),
        new Plugin({
          key: diffKey,
          state: {
            init: function () { return DecorationSet.empty; },
            apply: function (tr, old, prev, next) {
              var meta = tr.getMeta(diffKey);
              if (meta && meta.on != null) diffOn = !!meta.on;
              if (!diffOn) return DecorationSet.empty;
              if (!tr.docChanged && !(meta && meta.on != null)) return old.map(tr.mapping, tr.doc);
              var baseline = options.getOriginal ? options.getOriginal() : (options.originalPlain || "");
              return buildDiffDecorations(next.doc, baseline);
            }
          },
          props: {
            decorations: function (editorState) { return diffKey.getState(editorState); }
          }
        }),
        new Plugin({
          key: commentKey,
          state: {
            init: function (_, editorState) {
              return buildCommentDecorations(editorState.doc, options.getComments ? options.getComments() : []);
            },
            apply: function (tr, old, prev, next) {
              if (!tr.docChanged && !tr.getMeta(commentKey)) return old.map(tr.mapping, tr.doc);
              return buildCommentDecorations(next.doc, options.getComments ? options.getComments() : []);
            }
          },
          props: {
            decorations: function (editorState) { return commentKey.getState(editorState); }
          }
        })
      ]
    });
    var view = new EditorView({ mount: mount }, {
      state: state,
      attributes: { spellcheck: "true", "aria-label": "Article" },
      dispatchTransaction: function (tr) {
        view.updateState(view.state.apply(tr));
        if (options.onChange) options.onChange(tr);
      },
      handlePaste: handlePaste,
      handleDOMEvents: {
        click: function (editorView, event) {
          var anchor = event.target && event.target.closest && event.target.closest("a");
          if (anchor && editorView.dom.contains(anchor)) event.preventDefault();
          return false;
        },
        submit: function (_, event) {
          event.preventDefault();
          return true;
        }
      },
      nodeViews: { opaque: opaqueView }
    });
    return {
      view: view,
      destroy: function () { view.destroy(); },
      getHTML: function () { return serialize(view.state.doc); },
      plain: function () { return plainText(view.state.doc); },
      getTitle: function () { return getTitle(view.state.doc); },
      setTitle: function (text) { return setTitle(view, text); },
      images: function () { return collectImages(view.state.doc); },
      setAlt: function (index, alt) { return setAlt(view, index, alt); },
      focus: function () { view.focus(); },
      run: function (command) {
        var ran = command(view.state, view.dispatch.bind(view), view);
        view.focus();
        return ran;
      },
      context: function () {
        var editorState = view.state;
        return {
          bold: markActive(editorState, schema.marks.strong) || markActive(editorState, schema.marks.b),
          italic: markActive(editorState, schema.marks.em) || markActive(editorState, schema.marks.i),
          underline: markActive(editorState, schema.marks.underline),
          link: !!getActiveLink(editorState),
          block: (function () {
            var depth = textblockDepth(editorState.selection.$from);
            return depth == null ? "" : editorState.selection.$from.node(depth).attrs.tag;
          })(),
          list: (function () {
            var $from = editorState.selection.$from;
            for (var depth = $from.depth; depth > 0; depth--) {
              var node = $from.node(depth);
              if (node.type.name === "element" && (node.attrs.tag === "ul" || node.attrs.tag === "ol")) return node.attrs.tag;
            }
            return "";
          })()
        };
      },
      commands: {
        bold: toggleEither("strong", "b"),
        italic: toggleEither("em", "i"),
        underline: toggleMark(schema.marks.underline),
        heading: setHeading,
        bullet: toggleList("ul"),
        numbered: toggleList("ol"),
        clear: clearFormatting,
        undo: undo,
        redo: redo
      },
      linkInfo: function () {
        var active = getActiveLink(view.state);
        return active ? active.html : null;
      },
      applyLink: function (href, newTab) { return applyLink(view, href, newTab); },
      removeLink: function () { return removeLink(view); },
      selectedQuote: function () { return selectedQuote(view.state); },
      setDiff: function (on) {
        view.dispatch(view.state.tr.setMeta(diffKey, { on: !!on }));
      },
      refreshComments: function () {
        view.dispatch(view.state.tr.setMeta(commentKey, { refresh: true }));
      },
      replaceDoc: function (nextDoc) {
        var tr = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
        view.dispatch(tr);
      }
    };
  }

  var editorCSS = [
    ".ProseMirror { position: relative; word-wrap: break-word; white-space: normal; -webkit-font-variant-ligatures: none; font-variant-ligatures: none; outline: none; min-height: 40vh; caret-color: currentColor; }",
    ".ProseMirror:focus { outline: none; }",
    ".ProseMirror pre, .ProseMirror [data-rm-hold] pre { white-space: pre-wrap; }",
    ".ProseMirror-hideselection *::selection { background: transparent; }",
    ".ProseMirror-selectednode { outline: 2px solid #7aa2ff; }",
    "img.ProseMirror-separator { display: inline !important; border: none !important; margin: 0 !important; width: 0 !important; height: 0 !important; max-width: 0 !important; padding: 0 !important; }",
    ".ProseMirror-gapcursor { display: none; pointer-events: none; position: absolute; }",
    ".ProseMirror-gapcursor:after { content: \"\"; display: block; position: absolute; top: -2px; width: 20px; border-top: 1px solid currentColor; animation: rm-cursor-blink 1.1s steps(2, start) infinite; }",
    ".ProseMirror-focused .ProseMirror-gapcursor { display: block; }",
    "@keyframes rm-cursor-blink { to { visibility: hidden; } }",
    ".rm-ins { background: rgba(70, 200, 110, 0.38); border-radius: 2px; }",
    ".rm-del { background: rgba(230, 70, 70, 0.28); text-decoration: line-through; }",
    ".rm-note { background: rgba(255, 190, 40, 0.38); box-shadow: inset 0 -2px 0 rgba(200, 140, 0, 0.9); }",
    ".rm-hold { margin: 0; }",
    ".rm-hold[hidden] { display: none !important; }"
  ].join("\n");

  root.RMDoc = {
    schema: schema,
    captureOpaque: captureOpaque,
    parseRoot: parseRoot,
    serialize: serialize,
    plainText: plainText,
    indexDoc: indexDoc,
    createEditor: createEditor,
    editorCSS: editorCSS,
    selectedQuote: selectedQuote
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
