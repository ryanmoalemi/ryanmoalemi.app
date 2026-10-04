import { Editor, Node, Mark, Extension } from "@tiptap/core";
import History from "@tiptap/extension-history";
import { keymap } from "@tiptap/pm/keymap";
import { baseKeymap, splitBlock } from "@tiptap/pm/commands";
import { Fragment } from "@tiptap/pm/model";

function hiddenAttrs(extra) {
  var attrs = {
    htmlAttrs: { default: null, rendered: false }
  };
  if (extra) {
    Object.keys(extra).forEach(function (key) { attrs[key] = extra[key]; });
  }
  return attrs;
}

function domAttrs(node) {
  return node.attrs.htmlAttrs || {};
}

function paintImage(img, node, resolveSrc) {
  var attrs = domAttrs(node);
  Array.prototype.slice.call(img.attributes).forEach(function (attr) {
    img.removeAttribute(attr.name);
  });
  Object.keys(attrs).forEach(function (key) {
    var value = attrs[key];
    if (value == null) return;
    if (key === "src") img.setAttribute("src", resolveSrc ? resolveSrc(value) : value);
    else img.setAttribute(key, value);
  });
}

function imageView(resolveSrc) {
  return function (props) {
    var img = document.createElement("img");
    paintImage(img, props.node, resolveSrc);
    return {
      dom: img,
      ignoreMutation: function () { return true; },
      update: function (updated) {
        if (updated.type.name !== props.node.type.name) return false;
        paintImage(img, updated, resolveSrc);
        return true;
      }
    };
  };
}

var DocumentNode = Node.create({
  name: "doc",
  topNode: true,
  content: "block+"
});

var TextNode = Node.create({
  name: "text",
  group: "inline"
});

var TextBlock = Node.create({
  name: "textBlock",
  group: "block",
  content: "inline*",
  defining: true,
  addAttributes: function () {
    return hiddenAttrs({ tag: { default: "p", rendered: false } });
  },
  renderHTML: function (props) {
    return [props.node.attrs.tag || "p", domAttrs(props.node), 0];
  },
  addNodeView: function () {
    return function (props) { return editorBlockView(props, null); };
  }
});

var BlockEl = Node.create({
  name: "blockEl",
  group: "block",
  content: "block*",
  defining: true,
  addAttributes: function () {
    return hiddenAttrs({ tag: { default: "div", rendered: false } });
  },
  renderHTML: function (props) {
    return [props.node.attrs.tag || "div", domAttrs(props.node), 0];
  },
  addNodeView: function () {
    return function (props) { return editorBlockView(props, null); };
  }
});

var InlineEl = Node.create({
  name: "inlineEl",
  group: "inline",
  inline: true,
  content: "inline*",
  addAttributes: function () {
    return hiddenAttrs({ tag: { default: "span", rendered: false } });
  },
  renderHTML: function (props) {
    return [props.node.attrs.tag || "span", domAttrs(props.node), 0];
  }
});

var InlineVoid = Node.create({
  name: "inlineVoid",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: function () {
    return hiddenAttrs({ tag: { default: "span", rendered: false } });
  },
  renderHTML: function (props) {
    var tag = props.node.attrs.tag || "span";
    return [tag, domAttrs(props.node)];
  }
});

function makeImage(name, inline, resolveSrc) {
  return Node.create({
    name: name,
    group: inline ? "inline" : "block",
    inline: inline,
    atom: true,
    draggable: false,
    addAttributes: function () { return hiddenAttrs(); },
    renderHTML: function (props) { return ["img", domAttrs(props.node)]; },
    addNodeView: function () { return function (props) { return editorBlockView(props, resolveSrc); }; }
  });
}

var RawNode = Node.create({
  name: "raw",
  group: "block",
  atom: true,
  draggable: false,
  selectable: true,
  addAttributes: function () {
    return { html: { default: "", rendered: false } };
  },
  renderHTML: function () { return ["div", { "data-rm-raw": "1" }]; },
  addNodeView: function () {
    return function (props) {
      var holder = document.createElement("div");
      holder.innerHTML = props.node.attrs.html || "";
      var el = holder.firstElementChild || holder;
      el.setAttribute("data-rm-raw", "1");
      el.setAttribute("contenteditable", "false");
      return {
        dom: el,
        ignoreMutation: function () { return true; },
        stopEvent: function () { return true; }
      };
    };
  }
});

var VoidBlock = Node.create({
  name: "voidBlock",
  group: "block",
  atom: true,
  addAttributes: function () {
    return hiddenAttrs({ tag: { default: "hr", rendered: false } });
  },
  renderHTML: function (props) {
    return [props.node.attrs.tag || "hr", domAttrs(props.node)];
  }
});

var HardBreak = Node.create({
  name: "hardBreak",
  group: "inline",
  inline: true,
  selectable: false,
  atom: true,
  renderHTML: function () { return ["br"]; }
});

function styleMark(name, shortcut, fallback) {
  return Mark.create({
    name: name,
    addAttributes: function () {
      return { tag: { default: fallback, rendered: false } };
    },
    renderHTML: function (props) {
      return [props.mark.attrs.tag || fallback, 0];
    },
    addKeyboardShortcuts: function () {
      var self = this;
      var keys = {};
      keys[shortcut] = function () { return self.editor.commands.toggleMark(self.name); };
      return keys;
    }
  });
}

var LinkMark = Mark.create({
  name: "link",
  inclusive: false,
  addAttributes: function () {
    return { htmlAttrs: { default: null, rendered: false } };
  },
  renderHTML: function (props) {
    return ["a", props.mark.attrs.htmlAttrs || {}, 0];
  }
});

var CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes: function () {
    return {
      id: { default: "", rendered: false },
      note: { default: "", rendered: false }
    };
  },
  renderHTML: function (props) {
    return ["span", {
      class: "rm-comment",
      "data-comment": props.mark.attrs.id || "",
      title: props.mark.attrs.note || ""
    }, 0];
  }
});

var Keys = Extension.create({
  name: "wordKeys",
  addProseMirrorPlugins: function () {
    var enter = function (state, dispatch) {
      var $from = state.selection.$from;
      for (var d = $from.depth; d > 0; d--) {
        var node = $from.node(d);
        if (node.type.name === "textBlock" && /^(td|th|figcaption|caption)$/.test(node.attrs.tag || "")) {
          if (dispatch) {
            dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hardBreak.create()).scrollIntoView());
          }
          return true;
        }
      }
      return splitBlock(state, dispatch);
    };
    return [keymap(Object.assign({}, baseKeymap, { Enter: enter }))];
  }
});

function extensions(resolveSrc) {
  return [
    DocumentNode,
    TextNode,
    TextBlock,
    BlockEl,
    InlineEl,
    InlineVoid,
    makeImage("image", false, resolveSrc),
    makeImage("inlineImage", true, resolveSrc),
    RawNode,
    VoidBlock,
    HardBreak,
    styleMark("bold", "Mod-b", "strong"),
    styleMark("italic", "Mod-i", "em"),
    styleMark("underline", "Mod-u", "u"),
    LinkMark,
    CommentMark,
    History.configure({ depth: 200, newGroupDelay: 500 }),
    Keys
  ];
}

var blockCallbacks = { onSlash: null, onImageFile: null };

function attrOf(node, name) {
  var attrs = node && node.attrs && node.attrs.htmlAttrs;
  if (!attrs || attrs[name] == null || attrs[name] === "") return "";
  return String(attrs[name]);
}

function hasClass(node, name) {
  return attrOf(node, "class").split(/\s+/).indexOf(name) !== -1;
}

function blockKind(node, $pos) {
  if (!node || !$pos) return null;
  var inFaq = false;
  var inCard = false;
  var inFigure = false;
  var inListItem = false;
  var inCell = false;
  var inQuote = false;
  var inDetails = false;
  for (var d = $pos.depth; d > 0; d--) {
    var anc = $pos.node(d);
    var aTag = anc.attrs && anc.attrs.tag;
    var id = attrOf(anc, "id").toLowerCase();
    var cls = attrOf(anc, "class").toLowerCase();
    if (id === "faq" || id.indexOf("faq") !== -1 || cls.split(/\s+/).indexOf("faq") !== -1) inFaq = true;
    if (aTag === "article" && hasClass(anc, "card")) inCard = true;
    if (aTag === "figure") inFigure = true;
    if (aTag === "li") inListItem = true;
    if (aTag === "td" || aTag === "th") inCell = true;
    if (aTag === "blockquote") inQuote = true;
    if (aTag === "details") inDetails = true;
  }
  if (node.type.name === "image") {
    if (inFigure) return null;
    return { kind: "image", label: "Image" };
  }
  if (node.type.name === "inlineImage" || node.type.name === "raw" || node.type.name === "voidBlock") return null;
  var tag = (node.attrs && node.attrs.tag) || "";
  if (node.type.name === "textBlock") {
    if (inCard || inFigure || inListItem || inCell || inQuote || inDetails) return null;
    if (tag === "p") return { kind: "paragraph", label: "Paragraph" };
    if (/^h[1-6]$/.test(tag)) return { kind: "heading", label: tag === "h1" ? "Title" : "Heading" };
    return null;
  }
  if (node.type.name !== "blockEl") return null;
  if (tag === "figure") return { kind: "image", label: "Image" };
  if (tag === "table") return { kind: "table", label: "Table" };
  if (tag === "blockquote") return { kind: "quote", label: "Quote" };
  if ((tag === "ul" || tag === "ol") && !inListItem) return { kind: "list", label: tag === "ol" ? "Numbered list" : "List" };
  if (tag === "details") return { kind: "faq", label: "FAQ" };
  if (tag === "article" && hasClass(node, "card") && inFaq) return { kind: "faq", label: "FAQ" };
  if (tag === "div" && hasClass(node, "grid") && hasClass(node, "cards")) return { kind: "cards", label: "Card grid" };
  return null;
}

function syncAttrs(el, node) {
  var next = domAttrs(node);
  Array.prototype.slice.call(el.attributes).forEach(function (attr) {
    if (attr.name === "contenteditable") return;
    if (!Object.prototype.hasOwnProperty.call(next, attr.name)) el.removeAttribute(attr.name);
  });
  Object.keys(next).forEach(function (key) {
    if (next[key] == null) return;
    if (el.getAttribute(key) !== String(next[key])) el.setAttribute(key, String(next[key]));
  });
}

function chromeButton(doc, label, action) {
  var button = doc.createElement("button");
  button.type = "button";
  button.className = "rm-block-btn";
  button.textContent = label;
  button.addEventListener("mousedown", function (event) { event.preventDefault(); });
  button.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    action();
  });
  return button;
}

function isCreditNode(node) {
  if (!node || (node.type.name !== "inlineEl" && node.type.name !== "inlineVoid")) return false;
  return hasClass(node, "credit");
}

function figureBits(node) {
  var bits = { alt: "", src: "", width: "", height: "", caption: "", credit: "", source: "" };
  if (!node) return bits;
  node.descendants(function (child) {
    if (child.type.name === "image" || child.type.name === "inlineImage") {
      var attrs = child.attrs.htmlAttrs || {};
      bits.alt = attrs.alt || "";
      bits.src = attrs.src || "";
      bits.width = attrs.width || "";
      bits.height = attrs.height || "";
    }
    if (child.type.name === "textBlock" && child.attrs.tag === "figcaption") {
      var credit = "";
      var source = "";
      child.descendants(function (inline) {
        if (!isCreditNode(inline)) return;
        credit = (inline.textContent || "").replace(/\s+/g, " ").trim();
        inline.descendants(function (inner) {
          (inner.marks || []).forEach(function (mark) {
            if (mark.type.name === "link" && mark.attrs.htmlAttrs && mark.attrs.htmlAttrs.href) source = mark.attrs.htmlAttrs.href;
          });
        });
      });
      var caption = (child.textContent || "").replace(/\s+/g, " ").trim();
      if (credit && caption.indexOf(credit) !== -1) caption = caption.replace(credit, "").replace(/\s+/g, " ").trim();
      bits.caption = caption;
      bits.credit = credit;
      bits.source = source;
    }
  });
  if (node.type.name === "image" || node.type.name === "inlineImage") {
    var own = node.attrs.htmlAttrs || {};
    bits.alt = own.alt || "";
    bits.src = own.src || "";
    bits.width = own.width || "";
    bits.height = own.height || "";
  }
  return bits;
}

function editorBlockView(props, resolveSrc) {
  var node = props.node;
  var tag = node.type.name === "image" || node.type.name === "inlineImage" ? "img" : (node.attrs.tag || "div");
  var content = document.createElement(tag);
  if (node.type.name === "image" || node.type.name === "inlineImage") paintImage(content, node, resolveSrc);
  else syncAttrs(content, node);
  var pos = null;
  try { if (typeof props.getPos === "function") pos = props.getPos(); }
  catch (err) { pos = null; }
  var kind = null;
  if (typeof pos === "number") {
    try { kind = blockKind(node, props.editor.state.doc.resolve(pos)); }
    catch (err) { kind = null; }
  }
  if (!kind) {
    return {
      dom: content,
      contentDOM: node.type.name === "image" || node.type.name === "inlineImage" ? null : content,
      ignoreMutation: function () { return node.type.name === "image" || node.type.name === "inlineImage"; },
      update: function (updated) {
        if (updated.type !== node.type) return false;
        var nextTag = updated.type.name === "image" || updated.type.name === "inlineImage" ? "img" : (updated.attrs.tag || "");
        if (nextTag !== content.tagName.toLowerCase()) return false;
        var nextPos = typeof props.getPos === "function" ? props.getPos() : null;
        if (typeof nextPos === "number") {
          try {
            if (blockKind(updated, props.editor.state.doc.resolve(nextPos))) return false;
          } catch (err) { return false; }
        }
        if (updated.type.name === "image" || updated.type.name === "inlineImage") paintImage(content, updated, resolveSrc);
        else syncAttrs(content, updated);
        return true;
      }
    };
  }
  var doc = content.ownerDocument;
  var wrap = doc.createElement("div");
  wrap.className = "rm-block";
  wrap.setAttribute("data-kind", kind.kind);
  var bar = doc.createElement("div");
  bar.className = "rm-chrome";
  bar.setAttribute("contenteditable", "false");
  var label = doc.createElement("span");
  label.className = "rm-label";
  label.textContent = kind.label;
  var handle = chromeButton(doc, "Drag", function () {});
  handle.draggable = true;
  handle.setAttribute("aria-label", "Drag to reorder");
  handle.addEventListener("dragstart", function (event) {
    var at = props.getPos();
    event.dataTransfer.setData("text/plain", "rm-block:" + at);
    event.dataTransfer.effectAllowed = "move";
  });
  bar.append(label, handle);
  bar.append(chromeButton(doc, "Up", function () { moveBlock(props.editor, props.getPos(), -1); }));
  bar.append(chromeButton(doc, "Down", function () { moveBlock(props.editor, props.getPos(), 1); }));
  bar.append(chromeButton(doc, "Duplicate", function () { duplicateBlock(props.editor, props.getPos()); }));
  bar.append(chromeButton(doc, "Delete", function () { deleteBlock(props.editor, props.getPos()); }));
  var fields = null;
  var inputs = {};
  if (kind.kind === "image") {
    fields = doc.createElement("div");
    fields.className = "rm-fields";
    var file = doc.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.className = "rm-file";
    file.setAttribute("aria-label", "Upload image");
    file.addEventListener("change", function () {
      var picked = file.files && file.files[0];
      file.value = "";
      if (!picked || !blockCallbacks.onImageFile) return;
      blockCallbacks.onImageFile(picked, props.getPos());
    });
    function field(name, title) {
      var box = doc.createElement("label");
      var span = doc.createElement("span");
      span.textContent = title;
      var input = doc.createElement("input");
      input.type = name === "source" ? "url" : "text";
      input.setAttribute("aria-label", title);
      inputs[name] = input;
      input.addEventListener("input", function () {
        var patch = {};
        patch[name] = input.value;
        if (name === "credit" || name === "source") {
          patch.credit = inputs.credit ? inputs.credit.value : "";
          patch.source = inputs.source ? inputs.source.value : "";
        }
        setFigureFields(props.editor, props.getPos(), patch);
      });
      box.append(span, input);
      return box;
    }
    var upload = doc.createElement("label");
    upload.className = "rm-upload";
    upload.append(doc.createTextNode("Replace"), file);
    fields.append(upload, field("alt", "Alt text"), field("caption", "Caption"), field("credit", "Credit"), field("source", "Source link"));
    bar.append(fields);
    syncFigureInputs(inputs, figureBits(node));
  }
  var plus = chromeButton(doc, "+", function () {
    if (blockCallbacks.onSlash) blockCallbacks.onSlash(props.editor.view, props.getPos(), "after");
  });
  plus.className = "rm-plus";
  plus.setAttribute("aria-label", "Insert block");
  wrap.append(bar, content, plus);
  wrap.addEventListener("dragover", function (event) {
    var types = event.dataTransfer && event.dataTransfer.types;
    if (!types) return;
    var ok = false;
    for (var i = 0; i < types.length; i++) if (types[i] === "text/plain") ok = true;
    if (!ok) return;
    event.preventDefault();
  });
  wrap.addEventListener("drop", function (event) {
    var raw = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
    if (raw.indexOf("rm-block:") !== 0) return;
    event.preventDefault();
    var from = Number(raw.slice("rm-block:".length));
    var to = props.getPos();
    if (!isFinite(from) || typeof to !== "number") return;
    moveBlockTo(props.editor, from, to);
  });
  var atom = node.type.name === "image" || node.type.name === "inlineImage";
  return {
    dom: wrap,
    contentDOM: atom ? null : content,
    ignoreMutation: function (record) {
      if (atom) return true;
      return !content.contains(record.target);
    },
    stopEvent: function (event) {
      var target = event.target;
      if (!target || !wrap.contains(target)) return false;
      if (!atom && content.contains(target)) return false;
      return true;
    },
    update: function (updated) {
      if (updated.type !== node.type) return false;
      var nextTag = atom ? "img" : (updated.attrs.tag || "");
      if (!atom && nextTag !== content.tagName.toLowerCase()) return false;
      var nextPos = props.getPos();
      var nextKind = null;
      if (typeof nextPos === "number") {
        try { nextKind = blockKind(updated, props.editor.state.doc.resolve(nextPos)); }
        catch (err) { return false; }
      }
      if (!nextKind || nextKind.kind !== kind.kind) return false;
      if (atom) paintImage(content, updated, resolveSrc);
      else syncAttrs(content, updated);
      if (inputs.alt) {
        var active = doc.activeElement;
        if (active !== inputs.alt && active !== inputs.caption && active !== inputs.credit && active !== inputs.source) {
          syncFigureInputs(inputs, figureBits(updated));
        }
      }
      return true;
    }
  };
}

function syncFigureInputs(inputs, bits) {
  if (inputs.alt) inputs.alt.value = bits.alt || "";
  if (inputs.caption) inputs.caption.value = bits.caption || "";
  if (inputs.credit) inputs.credit.value = bits.credit || "";
  if (inputs.source) inputs.source.value = bits.source || "";
}

function preferredFigureClass(doc) {
  var found = "";
  doc.descendants(function (node) {
    if (found) return false;
    if (node.type.name === "blockEl" && node.attrs.tag === "figure") found = attrOf(node, "class");
  });
  return found || null;
}

function pageFaqMode(doc) {
  var cards = false;
  var details = false;
  doc.descendants(function (node, pos) {
    if (node.type.name === "blockEl" && node.attrs.tag === "details") details = true;
    if (node.type.name === "blockEl" && node.attrs.tag === "div" && hasClass(node, "grid") && hasClass(node, "cards")) {
      var $pos = doc.resolve(pos);
      for (var d = $pos.depth; d > 0; d--) {
        if (attrOf($pos.node(d), "id").toLowerCase().indexOf("faq") !== -1) cards = true;
      }
    }
  });
  if (cards) return "card";
  if (details) return "details";
  return "details";
}

function findFaqGrid(doc) {
  var found = null;
  doc.descendants(function (node, pos) {
    if (found) return false;
    if (node.type.name !== "blockEl" || node.attrs.tag !== "div" || !hasClass(node, "grid") || !hasClass(node, "cards")) return;
    var $pos = doc.resolve(pos);
    for (var d = $pos.depth; d > 0; d--) {
      if (attrOf($pos.node(d), "id").toLowerCase().indexOf("faq") !== -1) found = { node: node, pos: pos };
    }
  });
  return found;
}

function blockTemplate(schema, doc, kind) {
  function textBlock(tag, text, htmlAttrs) {
    return {
      type: "textBlock",
      attrs: { tag: tag, htmlAttrs: htmlAttrs || null },
      content: text ? [{ type: "text", text: text }] : []
    };
  }
  if (kind === "paragraph") return schema.nodeFromJSON(textBlock("p", ""));
  if (kind === "h2") return schema.nodeFromJSON(textBlock("h2", "Heading"));
  if (kind === "h3") return schema.nodeFromJSON(textBlock("h3", "Heading"));
  if (kind === "quote") {
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: "blockquote", htmlAttrs: null },
      content: [textBlock("p", "Quote")]
    });
  }
  if (kind === "ul" || kind === "ol") {
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: kind, htmlAttrs: null },
      content: [textBlock("li", "Item")]
    });
  }
  if (kind === "image") {
    var figClass = preferredFigureClass(doc);
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: "figure", htmlAttrs: figClass ? { class: figClass } : null },
      content: [
        { type: "image", attrs: { htmlAttrs: { alt: "" } } },
        textBlock("figcaption", "")
      ]
    });
  }
  if (kind === "table") {
    function cell(tag, text) { return textBlock(tag, text); }
    function row(tag, cells) {
      return { type: "blockEl", attrs: { tag: "tr", htmlAttrs: null }, content: cells };
    }
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: "table", htmlAttrs: null },
      content: [
        { type: "blockEl", attrs: { tag: "thead", htmlAttrs: null }, content: [row("tr", [cell("th", "Column"), cell("th", "Column")])] },
        { type: "blockEl", attrs: { tag: "tbody", htmlAttrs: null }, content: [row("tr", [cell("td", ""), cell("td", "")])] }
      ]
    });
  }
  if (kind === "cards") {
    function card(title) {
      return {
        type: "blockEl",
        attrs: { tag: "article", htmlAttrs: { class: "card" } },
        content: [textBlock("h3", title), textBlock("p", "")]
      };
    }
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: "div", htmlAttrs: { class: "grid cards" } },
      content: [card("Card"), card("Card")]
    });
  }
  if (kind === "faq") {
    if (pageFaqMode(doc) === "card") {
      return schema.nodeFromJSON({
        type: "blockEl",
        attrs: { tag: "article", htmlAttrs: { class: "card" } },
        content: [textBlock("h3", "Question"), textBlock("p", "Answer")]
      });
    }
    return schema.nodeFromJSON({
      type: "blockEl",
      attrs: { tag: "details", htmlAttrs: null },
      content: [textBlock("summary", "Question"), textBlock("p", "Answer")]
    });
  }
  return null;
}

function resolveFigure(editor, pos) {
  var $pos = null;
  try { $pos = editor.state.doc.resolve(pos); }
  catch (err) { $pos = null; }
  if ($pos) {
    for (var d = $pos.depth; d > 0; d--) {
      var node = $pos.node(d);
      if (node.type.name === "blockEl" && node.attrs.tag === "figure") return { node: node, pos: $pos.before(d) };
    }
  }
  var direct = editor.state.doc.nodeAt(pos);
  if (!direct) return null;
  return { node: direct, pos: pos };
}

export function createWordEditor(options) {
  var resolveSrc = options.resolveSrc || function (src) { return src; };
  blockCallbacks.onSlash = options.onSlash || null;
  blockCallbacks.onImageFile = options.onImageFile || null;
  return new Editor({
    element: options.element,
    extensions: extensions(resolveSrc),
    content: options.doc,
    injectCSS: true,
    autofocus: false,
    editorProps: {
      attributes: {
        spellcheck: "true",
        "aria-label": "Article"
      },
      handleKeyDown: function (view, event) {
        if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return false;
        var $from = view.state.selection.$from;
        if (!$from.parent.isTextblock) return false;
        if ($from.parent.textBetween(0, $from.parentOffset, "", "").length) return false;
        if (blockCallbacks.onSlash) blockCallbacks.onSlash(view, $from.before($from.depth), "replace");
        return true;
      },
      handlePaste: function (view, event) {
        var data = event.clipboardData;
        var text = data ? data.getData("text/plain") : "";
        if (!text) return false;
        var flat = text.replace(/\s+/g, " ").trim();
        if (!flat) return true;
        view.dispatch(view.state.tr.insertText(flat).scrollIntoView());
        return true;
      }
    },
    onUpdate: function () { if (options.onUpdate) options.onUpdate(); },
    onSelectionUpdate: function () { if (options.onSelection) options.onSelection(); }
  });
}

function withRange(editor, range) {
  var chain = editor.chain().focus();
  if (range) chain = chain.setTextSelection(range);
  return chain;
}

export function toggleBold(editor) { return editor.chain().focus().toggleMark("bold").run(); }
export function toggleItalic(editor) { return editor.chain().focus().toggleMark("italic").run(); }
export function toggleUnderline(editor) { return editor.chain().focus().toggleMark("underline").run(); }
export function undo(editor) { return editor.chain().focus().undo().run(); }
export function redo(editor) { return editor.chain().focus().redo().run(); }

export function toggleHeading(editor, level) {
  var tag = level === 3 ? "h3" : "h2";
  return editor.chain().focus().command(function (props) {
    var state = props.state;
    var tr = props.tr;
    var dispatch = props.dispatch;
    var changed = false;
    state.doc.nodesBetween(state.selection.from, state.selection.to, function (node, pos) {
      if (node.type.name !== "textBlock") return;
      if (!/^(p|h2|h3)$/.test(node.attrs.tag || "")) return false;
      var next = node.attrs.tag === tag ? "p" : tag;
      if (node.attrs.tag !== next) {
        tr.setNodeMarkup(pos, undefined, Object.assign({}, node.attrs, { tag: next }));
        changed = true;
      }
      return false;
    });
    if (changed && dispatch) dispatch(tr);
    return changed;
  }).run();
}

export function toggleList(editor, listTag) {
  return editor.chain().focus().command(function (props) {
    var state = props.state;
    var tr = props.tr;
    var dispatch = props.dispatch;
    var $from = state.selection.$from;
    var d;
    for (d = $from.depth; d > 0; d--) {
      var node = $from.node(d);
      if (node.type.name === "blockEl" && (node.attrs.tag === "ul" || node.attrs.tag === "ol")) {
        var pos = $from.before(d);
        if (node.attrs.tag === listTag) {
          var children = [];
          node.content.forEach(function (child) {
            if (child.type.name === "textBlock" && child.attrs.tag === "li") {
              children.push(state.schema.nodes.textBlock.create({ tag: "p", htmlAttrs: null }, child.content));
            } else children.push(child);
          });
          tr.replaceWith(pos, pos + node.nodeSize, Fragment.from(children));
        } else {
          tr.setNodeMarkup(pos, undefined, Object.assign({}, node.attrs, { tag: listTag }));
        }
        if (dispatch) dispatch(tr);
        return true;
      }
    }
    for (d = $from.depth; d > 0; d--) {
      var block = $from.node(d);
      if (block.type.name === "textBlock" && /^(p|h2|h3)$/.test(block.attrs.tag || "")) {
        var at = $from.before(d);
        var li = state.schema.nodes.textBlock.create({ tag: "li", htmlAttrs: null }, block.content);
        var list = state.schema.nodes.blockEl.create({ tag: listTag, htmlAttrs: null }, li);
        tr.replaceWith(at, at + block.nodeSize, list);
        if (dispatch) dispatch(tr);
        return true;
      }
    }
    return false;
  }).run();
}

export function applyLink(editor, htmlAttrs, range) {
  return withRange(editor, range).setMark("link", { htmlAttrs: htmlAttrs }).run();
}

export function removeLink(editor, range) {
  return withRange(editor, range).unsetMark("link").run();
}

export function clearFormatting(editor) {
  return editor.chain().focus()
    .unsetMark("bold")
    .unsetMark("italic")
    .unsetMark("underline")
    .unsetMark("link")
    .command(function (props) {
      var changed = false;
      props.state.doc.nodesBetween(props.state.selection.from, props.state.selection.to, function (node, pos) {
        if (node.type.name === "textBlock" && (node.attrs.tag === "h2" || node.attrs.tag === "h3")) {
          props.tr.setNodeMarkup(pos, undefined, Object.assign({}, node.attrs, { tag: "p" }));
          changed = true;
        }
      });
      if (props.dispatch) props.dispatch(props.tr);
      return true || changed;
    }).run();
}

export function addComment(editor, id, note, range) {
  return withRange(editor, range).setMark("comment", { id: id, note: note }).run();
}

export function removeComment(editor, id) {
  var tr = editor.state.tr;
  var comment = editor.schema.marks.comment;
  editor.state.doc.descendants(function (node, pos) {
    if (!node.isText) return;
    var mark = node.marks.find(function (item) { return item.type === comment && item.attrs.id === id; });
    if (mark) tr.removeMark(pos, pos + node.nodeSize, mark);
  });
  editor.view.dispatch(tr);
}

export function listComments(editor) {
  var groups = {};
  var order = [];
  editor.state.doc.descendants(function (node) {
    if (!node.isText) return;
    node.marks.forEach(function (mark) {
      if (mark.type.name !== "comment") return;
      var id = mark.attrs.id || "";
      if (!groups[id]) {
        groups[id] = { id: id, note: mark.attrs.note || "", quote: "" };
        order.push(id);
      }
      groups[id].quote += node.text || "";
    });
  });
  return order.map(function (id) { return groups[id]; });
}

export function listImages(editor) {
  var images = [];
  editor.state.doc.descendants(function (node, pos) {
    if (node.type.name !== "image" && node.type.name !== "inlineImage") return;
    var attrs = node.attrs.htmlAttrs || {};
    var caption = "";
    var $pos = editor.state.doc.resolve(pos);
    for (var d = $pos.depth; d > 0; d--) {
      var parent = $pos.node(d);
      if (parent.type.name === "blockEl" && parent.attrs.tag === "figure") {
        parent.descendants(function (child) {
          if (child.type.name === "textBlock" && child.attrs.tag === "figcaption") caption = child.textContent || "";
        });
      }
    }
    images.push({
      index: images.length,
      pos: pos,
      src: attrs.src || "",
      alt: attrs.alt || "",
      caption: caption.replace(/\s+/g, " ").trim()
    });
  });
  return images;
}

export function setImageAlt(editor, index, alt) {
  var found = null;
  var i = 0;
  editor.state.doc.descendants(function (node, pos) {
    if (node.type.name !== "image" && node.type.name !== "inlineImage") return;
    if (i === index) found = { node: node, pos: pos };
    i += 1;
  });
  if (!found) return false;
  var htmlAttrs = Object.assign({}, found.node.attrs.htmlAttrs, { alt: alt });
  var tr = editor.state.tr.setNodeMarkup(found.pos, undefined, Object.assign({}, found.node.attrs, { htmlAttrs: htmlAttrs }));
  editor.view.dispatch(tr);
  return true;
}

export function getH1Text(editor) {
  var text = null;
  editor.state.doc.descendants(function (node) {
    if (text == null && node.type.name === "textBlock" && node.attrs.tag === "h1") text = node.textContent || "";
  });
  return text;
}

export function setH1Text(editor, text) {
  var found = null;
  editor.state.doc.descendants(function (node, pos) {
    if (!found && node.type.name === "textBlock" && node.attrs.tag === "h1") found = { node: node, pos: pos };
  });
  if (!found) return false;
  var next = text
    ? found.node.type.create(found.node.attrs, editor.schema.text(text))
    : found.node.type.create(found.node.attrs);
  editor.view.dispatch(editor.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, next));
  return true;
}

export function activeState(editor) {
  var $from = editor.state.selection.$from;
  var tag = "";
  var list = "";
  for (var d = $from.depth; d > 0; d--) {
    var node = $from.node(d);
    if (!tag && node.type.name === "textBlock") tag = node.attrs.tag || "";
    if (!list && node.type.name === "blockEl" && (node.attrs.tag === "ul" || node.attrs.tag === "ol")) list = node.attrs.tag;
  }
  var link = editor.getAttributes("link");
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    link: editor.isActive("link"),
    h2: tag === "h2",
    h3: tag === "h3",
    bullet: list === "ul",
    ordered: list === "ol",
    linkAttrs: link && link.htmlAttrs ? link.htmlAttrs : null
  };
}

export function selectionRange(editor) {
  return { from: editor.state.selection.from, to: editor.state.selection.to };
}

export function selectedText(editor) {
  var sel = editor.state.selection;
  if (sel.empty) return "";
  return editor.state.doc.textBetween(sel.from, sel.to, " ");
}

export function insertBlock(editor, kind, pos, place) {
  var node = blockTemplate(editor.schema, editor.state.doc, kind);
  if (!node || typeof pos !== "number") return false;
  var tr = editor.state.tr;
  if (kind === "faq" && node.attrs.tag === "article") {
    var grid = findFaqGrid(editor.state.doc);
    if (grid) {
      tr.insert(grid.pos + grid.node.nodeSize - 1, node);
      editor.view.dispatch(tr.scrollIntoView());
      return true;
    }
  }
  var current = editor.state.doc.nodeAt(pos);
  if (place === "replace" && current && current.type.name === "textBlock" && !current.textContent) {
    tr.replaceWith(pos, pos + current.nodeSize, node);
  } else if (current) {
    tr.insert(pos + current.nodeSize, node);
  } else {
    tr.insert(pos, node);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function moveBlock(editor, pos, dir) {
  var node = editor.state.doc.nodeAt(pos);
  if (!node || !dir) return false;
  var $pos = editor.state.doc.resolve(pos);
  var index = $pos.index();
  var parent = $pos.parent;
  var next = index + (dir < 0 ? -1 : 1);
  if (next < 0 || next >= parent.childCount) return false;
  var sibling = parent.child(next);
  var start = dir < 0 ? pos - sibling.nodeSize : pos;
  var slice = dir < 0 ? Fragment.from([node, sibling]) : Fragment.from([sibling, node]);
  editor.view.dispatch(editor.state.tr.replaceWith(start, start + node.nodeSize + sibling.nodeSize, slice).scrollIntoView());
  return true;
}

export function moveBlockTo(editor, from, to) {
  if (from === to || !isFinite(from) || !isFinite(to)) return false;
  var node = editor.state.doc.nodeAt(from);
  var target = editor.state.doc.nodeAt(to);
  if (!node || !target) return false;
  var $from = editor.state.doc.resolve(from);
  var $to = editor.state.doc.resolve(to);
  if ($from.parent !== $to.parent) return false;
  var tr = editor.state.tr;
  if (to > from) {
    tr.insert(to + target.nodeSize, node);
    tr.delete(from, from + node.nodeSize);
  } else {
    tr.delete(from, from + node.nodeSize);
    tr.insert(to, node);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function duplicateBlock(editor, pos) {
  var node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  editor.view.dispatch(editor.state.tr.insert(pos + node.nodeSize, node.copy(node.content)).scrollIntoView());
  return true;
}

export function deleteBlock(editor, pos) {
  var node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  var $pos = editor.state.doc.resolve(pos);
  var tr = editor.state.tr;
  if ($pos.parent.type.name === "doc" && $pos.parent.childCount <= 1) {
    var empty = editor.schema.nodes.textBlock.create({ tag: "p", htmlAttrs: null });
    tr.replaceWith(pos, pos + node.nodeSize, empty);
  } else {
    tr.delete(pos, pos + node.nodeSize);
  }
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function creditNode(schema, credit, source) {
  var mark = source ? schema.marks.link.create({ htmlAttrs: { href: source, target: "_blank", rel: "noopener noreferrer" } }) : null;
  var text = schema.text(credit, mark ? [mark] : null);
  return schema.nodes.inlineEl.create({ tag: "span", htmlAttrs: { class: "credit" } }, text);
}

export function setFigureFields(editor, pos, patch) {
  patch = patch || {};
  var found = resolveFigure(editor, pos);
  if (!found) return false;
  var figure = found.node;
  var figurePos = found.pos;
  var tr = editor.state.tr;
  if (figure.type.name === "image" || figure.type.name === "inlineImage") {
    var own = Object.assign({}, figure.attrs.htmlAttrs);
    ["alt", "src", "width", "height"].forEach(function (key) {
      if (patch[key] != null) own[key] = String(patch[key]);
    });
    tr.setNodeMarkup(figurePos, undefined, Object.assign({}, figure.attrs, { htmlAttrs: own }));
    editor.view.dispatch(tr);
    return true;
  }
  var imageNode = null;
  var imagePos = null;
  var capNode = null;
  var capPos = null;
  figure.descendants(function (child, rel) {
    if (!imageNode && (child.type.name === "image" || child.type.name === "inlineImage")) {
      imageNode = child;
      imagePos = figurePos + 1 + rel;
    }
    if (!capNode && child.type.name === "textBlock" && child.attrs.tag === "figcaption") {
      capNode = child;
      capPos = figurePos + 1 + rel;
    }
  });
  var touchesImage = ["alt", "src", "width", "height"].some(function (key) { return patch[key] != null; });
  if (imageNode && touchesImage) {
    var htmlAttrs = Object.assign({}, imageNode.attrs.htmlAttrs);
    ["alt", "src", "width", "height"].forEach(function (key) {
      if (patch[key] != null) htmlAttrs[key] = String(patch[key]);
    });
    tr.setNodeMarkup(imagePos, undefined, Object.assign({}, imageNode.attrs, { htmlAttrs: htmlAttrs }));
  }
  var touchesCaption = patch.caption != null || patch.credit != null || patch.source != null;
  if (touchesCaption) {
    var bits = figureBits(figure);
    var kids = [];
    if (capNode) capNode.content.forEach(function (child) { kids.push(child); });
    if (patch.caption != null) {
      var cap = String(patch.caption).replace(/\s+/g, " ").trim();
      kids = cap ? [editor.schema.text(cap)] : [];
    } else {
      var kept = [];
      kids.forEach(function (child, index) {
        if (isCreditNode(child)) return;
        if (child.isText && child.text === " " && kids[index + 1] && isCreditNode(kids[index + 1])) return;
        kept.push(child);
      });
      kids = kept;
    }
    var credit = patch.credit != null ? String(patch.credit).replace(/\s+/g, " ").trim() : bits.credit;
    var source = patch.source != null ? String(patch.source).trim() : bits.source;
    if (credit) {
      if (kids.length) kids.push(editor.schema.text(" "));
      kids.push(creditNode(editor.schema, credit, source));
    }
    var nextCap = capNode
      ? capNode.type.create(capNode.attrs, kids.length ? Fragment.from(kids) : null)
      : editor.schema.nodes.textBlock.create({ tag: "figcaption", htmlAttrs: null }, kids.length ? Fragment.from(kids) : null);
    if (capNode) tr.replaceWith(capPos, capPos + capNode.nodeSize, nextCap);
    else tr.insert(figurePos + figure.nodeSize - 1, nextCap);
  }
  if (!tr.docChanged) return true;
  editor.view.dispatch(tr);
  return true;
}

export function replaceImageSrc(editor, oldSrc, attrs) {
  function samePath(a, b) {
    return String(a || "").replace(/^\/+/, "") === String(b || "").replace(/^\/+/, "");
  }
  var tr = editor.state.tr;
  var changed = false;
  editor.state.doc.descendants(function (node, pos) {
    if (node.type.name !== "image" && node.type.name !== "inlineImage") return;
    var src = (node.attrs.htmlAttrs || {}).src || "";
    if (oldSrc && !samePath(src, oldSrc)) return;
    var htmlAttrs = Object.assign({}, node.attrs.htmlAttrs, attrs || {});
    tr.setNodeMarkup(pos, undefined, Object.assign({}, node.attrs, { htmlAttrs: htmlAttrs }));
    changed = true;
  });
  if (changed) editor.view.dispatch(tr);
  return changed;
}

export function readPostFields(editor) {
  var author = "";
  var hasAuthor = false;
  var date = "";
  var datePrefix = "Published";
  var hasDate = false;
  var category = "";
  var hasCategory = false;
  var tags = [];
  var hasTags = false;
  editor.state.doc.descendants(function (node) {
    if (!hasAuthor && node.type.name === "textBlock" && hasClass(node, "byline")) {
      hasAuthor = true;
      author = (node.textContent || "").replace(/\s+/g, " ").trim().replace(/^By\s+/, "");
    }
    if (!hasCategory && hasClass(node, "cat")) {
      hasCategory = true;
      category = (node.textContent || "").replace(/\s+/g, " ").trim();
    }
    if (hasClass(node, "post-tags") || hasClass(node, "tag-list") || (hasClass(node, "tags") && node.type.name === "blockEl")) {
      hasTags = true;
    }
    if (hasClass(node, "tag")) {
      var tag = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (tag) tags.push(tag);
    }
  });
  editor.state.doc.descendants(function (node) {
    if (hasDate || !node.isText) return;
    var match = /^(Published|Updated)\s+(\S.*)$/.exec(node.text || "");
    if (!match) return;
    hasDate = true;
    datePrefix = match[1];
    date = match[2].replace(/\s+/g, " ").trim();
  });
  if (!tags.length) hasTags = false;
  return {
    author: author,
    hasAuthor: hasAuthor,
    date: date,
    datePrefix: datePrefix,
    hasDate: hasDate,
    category: category,
    hasCategory: hasCategory,
    tags: tags,
    hasTags: hasTags
  };
}

export function setAuthorName(editor, name) {
  var clean = String(name || "").replace(/\s+/g, " ").trim();
  var found = null;
  editor.state.doc.descendants(function (node, pos) {
    if (!found && node.type.name === "textBlock" && hasClass(node, "byline")) found = { node: node, pos: pos };
  });
  var label = clean ? "By " + clean : "By";
  if (!found) {
    if (!clean) return false;
    var h1 = null;
    editor.state.doc.descendants(function (node, pos) {
      if (!h1 && node.type.name === "textBlock" && node.attrs.tag === "h1") h1 = { node: node, pos: pos };
    });
    var byline = editor.schema.nodes.textBlock.create(
      { tag: "a", htmlAttrs: { class: "byline", href: "/authors/ryan-moalemi/" } },
      editor.schema.text(label)
    );
    editor.view.dispatch(editor.state.tr.insert(h1 ? h1.pos + h1.node.nodeSize : 0, byline));
    return true;
  }
  var tr = editor.state.tr;
  var replaced = false;
  found.node.descendants(function (node, rel) {
    if (replaced || !node.isText) return;
    if (!/^By\b/.test(node.text || "")) return;
    var abs = found.pos + 1 + rel;
    tr.insertText(label, abs, abs + node.nodeSize);
    replaced = true;
  });
  if (!replaced && clean) tr.insert(found.pos + found.node.nodeSize - 1, editor.schema.text(label));
  if (tr.docChanged) editor.view.dispatch(tr);
  return true;
}

export function setPublishedDate(editor, value) {
  var clean = String(value || "").replace(/\s+/g, " ").trim();
  var found = null;
  editor.state.doc.descendants(function (node, pos) {
    if (found || !node.isText) return;
    if (/^(Published|Updated)\s+/.test(node.text || "")) found = { node: node, pos: pos };
  });
  if (found) {
    var prefix = (/^(Published|Updated)/.exec(found.node.text) || ["Published"])[0];
    var text = clean ? prefix + " " + clean : prefix;
    editor.view.dispatch(editor.state.tr.insertText(text, found.pos, found.pos + found.node.nodeSize));
    return true;
  }
  if (!clean) return false;
  var row = null;
  editor.state.doc.descendants(function (node, pos) {
    if (!row && hasClass(node, "meta-row")) row = { node: node, pos: pos };
  });
  if (row && row.node.type.name === "textBlock") {
    var span = editor.schema.nodes.inlineEl.create({ tag: "span", htmlAttrs: null }, editor.schema.text("Published " + clean));
    editor.view.dispatch(editor.state.tr.insert(row.pos + row.node.nodeSize - 1, span));
    return true;
  }
  var h1 = null;
  editor.state.doc.descendants(function (node, pos) {
    if (!h1 && node.type.name === "textBlock" && node.attrs.tag === "h1") h1 = { node: node, pos: pos };
  });
  var para = editor.schema.nodes.textBlock.create({ tag: "p", htmlAttrs: null }, editor.schema.text("Published " + clean));
  editor.view.dispatch(editor.state.tr.insert(h1 ? h1.pos + h1.node.nodeSize : 0, para));
  return true;
}

export function setCategoryName(editor, value) {
  var found = null;
  editor.state.doc.descendants(function (node, pos) {
    if (!found && hasClass(node, "cat") && node.type.name !== "text") found = { node: node, pos: pos };
  });
  if (!found) return false;
  var text = String(value || "").replace(/\s+/g, " ").trim();
  var next = editor.schema.nodes.inlineEl.create(
    { tag: found.node.attrs.tag || "span", htmlAttrs: found.node.attrs.htmlAttrs },
    text ? editor.schema.text(text) : null
  );
  editor.view.dispatch(editor.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, next));
  return true;
}

export function setTagNames(editor, names) {
  var hosts = [];
  editor.state.doc.descendants(function (node, pos) {
    if (hasClass(node, "tag") && node.isText === false && (node.type.name === "inlineEl" || node.type.name === "textBlock" || node.type.name === "inlineVoid")) {
      hosts.push({ node: node, pos: pos });
    }
  });
  if (!hosts.length) return false;
  var list = names.slice(0, hosts.length);
  var tr = editor.state.tr;
  for (var i = hosts.length - 1; i >= 0; i--) {
    var item = hosts[i];
    var label = list[i] == null ? "" : String(list[i]).replace(/\s+/g, " ").trim();
    var next = editor.schema.nodes.inlineEl.create(
      { tag: item.node.attrs.tag || "span", htmlAttrs: item.node.attrs.htmlAttrs },
      label ? editor.schema.text(label) : null
    );
    tr.replaceWith(item.pos, item.pos + item.node.nodeSize, next);
  }
  editor.view.dispatch(tr);
  return true;
}

export function encodeImageFile(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var max = 2000;
      var w = img.naturalWidth || img.width || 1;
      var h = img.naturalHeight || img.height || 1;
      var scale = w > max ? max / w : 1;
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(function (blob) {
        URL.revokeObjectURL(url);
        if (!blob || blob.type !== "image/webp") {
          reject(new Error("This browser could not make a WebP image."));
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var data = String(reader.result || "");
          resolve({
            base64: data.indexOf(",") >= 0 ? data.split(",")[1] : "",
            width: cw,
            height: ch,
            blob: blob
          });
        };
        reader.onerror = function () { reject(new Error("Could not read that image.")); };
        reader.readAsDataURL(blob);
      }, "image/webp", 0.82);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
