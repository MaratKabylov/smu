import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { referenceUrl, videoEmbedUrl } from "./rich-text";

const LibraryImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null }, caption: { default: null } };
  },
});

const Callout = Node.create({
  name: "callout", group: "block", content: "block+", defining: true,
  addAttributes: () => ({ kind: { default: "info", parseHTML: element => element.getAttribute("data-kind") } }),
  parseHTML: () => [{ tag: "aside[data-smu-callout]" }],
  renderHTML: ({ node }) => ["aside", { "data-smu-callout": "", "data-kind": node.attrs.kind, class: `rich-text-callout rich-text-callout-${node.attrs.kind}` }, 0],
});

const Video = Node.create({
  name: "video", group: "block", atom: true,
  addAttributes: () => Object.fromEntries(["src", "title", "caption"].map(name => [name, {
    default: name === "caption" ? null : "", parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`),
  }])),
  parseHTML: () => [{ tag: "figure[data-smu-video]" }],
  // The editor shows a selectable card. Remote players are rendered in preview.
  renderHTML: ({ node }) => ["figure", { "data-smu-video": "", "data-src": node.attrs.src, "data-title": node.attrs.title, "data-caption": node.attrs.caption, class: "rich-text-video-card" },
    ["strong", {}, node.attrs.title || "Видео"], ["p", {}, node.attrs.caption || ""],
    ["a", { href: videoEmbedUrl(node.attrs.src ?? "") ?? undefined, rel: "noopener noreferrer" }, "YouTube / Vimeo"],
  ],
});

const referenceAttributes = () => Object.fromEntries(["label", "url", "doi"].map(name => [name, {
  default: name === "label" ? "" : null, parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`),
}]));

const Citation = Node.create({
  name: "citation", group: "inline", inline: true, atom: true,
  addAttributes: referenceAttributes,
  parseHTML: () => [{ tag: "sup[data-smu-citation]" }],
  renderHTML: ({ node }) => ["sup", { "data-smu-citation": "", "data-label": node.attrs.label, "data-url": node.attrs.url, "data-doi": node.attrs.doi, class: "rich-text-citation" },
    ["a", { href: referenceUrl(node.attrs) ?? undefined, rel: "noopener noreferrer" }, `[${node.attrs.label}]`],
  ],
});

const BibliographyEntry = Node.create({
  name: "bibliographyEntry", atom: true, selectable: true, priority: 1000,
  addAttributes: referenceAttributes,
  parseHTML: () => [{ tag: "li[data-smu-reference]" }],
  renderHTML: ({ node }) => ["li", { "data-smu-reference": "", "data-label": node.attrs.label, "data-url": node.attrs.url, "data-doi": node.attrs.doi },
    ["a", { href: referenceUrl(node.attrs) ?? undefined, rel: "noopener noreferrer" }, node.attrs.label],
    node.attrs.doi ? ` · DOI: ${node.attrs.doi}` : "",
  ],
});

const Bibliography = Node.create({
  name: "bibliography", group: "block", content: "bibliographyEntry+", defining: true,
  addAttributes: () => ({ title: { default: "", parseHTML: element => element.getAttribute("data-title") } }),
  parseHTML: () => [{ tag: "section[data-smu-bibliography]", contentElement: "ol" }],
  renderHTML: ({ node }) => ["section", { "data-smu-bibliography": "", "data-title": node.attrs.title, class: "rich-text-bibliography" },
    ["h3", {}, node.attrs.title], ["ol", {}, 0],
  ],
});

// Keep tables portable: no merged cells or stored pixel widths/styles.
const cellAttributes = () => ({ colspan: { default: 1 }, rowspan: { default: 1 }, colwidth: { default: null } });
export function articleEditorExtensions() {
  return [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } }), LibraryImage,
    Table.configure({ resizable: false, renderWrapper: true }), TableRow,
    TableCell.extend({ addAttributes: cellAttributes }), TableHeader.extend({ addAttributes: cellAttributes }),
    Callout, Video, Citation, Bibliography, BibliographyEntry];
}
