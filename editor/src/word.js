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
    addNodeView: function () { return imageView(resolveSrc); }
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

export function createWordEditor(options) {
  var resolveSrc = options.resolveSrc || function (src) { return src; };
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
