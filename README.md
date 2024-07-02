# Citater

`citater` (a fork of [obsidian-citation-plugin](https://github.com/hans/obsidian-citation-plugin)) is a minimal [Obsidian](https://obsidian.md) reference manager plugin.

## Installation

`citater` has not been officially added to the Obsidian community plugin list.
In the meantime, you can manually install the plugin by downloading `main.js` and `manifest.json` from [the latest release](https://github.com/oasci/citater/releases) and copy them to your vault at `.obsidian/plugins/citater`.

## Usage

The plugin offers four simple features at the moment:

1.  **Open literature note** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>): automatically create or open a literature note for a particular reference.
    The title, folder, and initial content of the note can be configured in the plugin settings.
2.  **Insert literature note reference** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>): insert a link to the literature note corresponding to a particular reference.
3.  **Insert literature note content in the current pane** (no hotkey by default): insert content describing a particular reference into the current pane.
    (This can be useful for updating literature notes you already have but which are missing reference information.)
4.  **Insert Markdown citation** (no hotkey by default): insert a [Pandoc-style citation][pandoc-citation] for a particular reference.
    (The exact format of the citation can be configured in the plugin settings.)

### Templates

You can set up your own template for both the title and content of literature notes.
The following variables can be used:

```text
* {{citekey}}
* {{abstract}}
* {{authorString}}
* {{containerTitle}}
* {{DOI}}
* {{eprint}}
* {{eprinttype}}
* {{eventPlace}}
* {{page}}
* {{publisher}}
* {{publisherPlace}}
* {{title}}
* {{titleShort}}
* {{URL}}
* {{year}}
```

For example, your literature note title template can simply be `@{{citekey}}` and the content template can look like:

```text
---
title: {{title}}
authors: {{authorString}}
year: {{year}}
---
{{abstract}}
```

## License

Code contained in this project is released under the [MIT License](https://spdx.org/licenses/MIT.html) as specified in [`LICENSE.md`][citater-license].
This license grants you the freedom to use, modify, and distribute it as long as you include the original copyright notice contained in [`LICENSE.md`][citater-license] and the following disclaimer.

> Portions of this code were incorporated and adapted with permission from [obsidian-citater-plugin](https://gitlab.com/oasci/software/obsidian-citater-plugin) by OASCI under the [MIT License](https://gitlab.com/oasci/software/obsidian-citater-plugin/-/blob/main/LICENSE.md).

[citater-license]: https://gitlab.com/oasci/software/obsidian-citater-plugin/-/blob/main/LICENSE.md
[pandoc-citation]: https://pandoc.org/MANUAL.html#extension-citations
