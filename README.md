# seal-converter

A small web app that turns lab protocols, experiment records and antibody mix calculations into HTML that pastes cleanly into the Seal electronic lab notebook.

Seal keeps only its own formatting when you paste, so values, reagents and notes lose their styling unless the HTML uses the exact markup Seal recognises. This app writes that markup for you.

Everything runs in your browser. Files you open and text you paste stay on your computer.

## Status

Work in progress. Protocols and experiments convert and copy into Seal. The antibody mix calculator is next.

| Module | What it does |
| --- | --- |
| Protocol | Open a .docx or .html file, or paste text, then copy the Seal version |
| Experiment | A short header, the mice, what was done, what changed, and the volumes used |
| Antibody mix | Import a panel from .xlsx and compute mix volumes as a Seal table (next) |

## Use it

Open the hosted version: https://mchauvinatlascope-ui.github.io/seal-converter/

To run it locally, clone the repository and open `index.html` in a browser. There is no build step and nothing to install.

```sh
git clone <repository-url>
cd seal-converter
open index.html   # or double-click the file
```

## Protocol import

You can bring a protocol in three ways:

- **A file**: click *Open a file* or drop it on the Source panel. Word (.docx), a saved or exported web page (.html) and plain text (.txt) all work. Heading styles become chapters and sections, Word lists become steps, tables stay tables, and bold and italic are kept.
- **Paste from Word, SharePoint or a web page**: paste into the empty Source box. The formatting that came with the paste is used the same way.
Sub levels are kept: a list item or an indented paragraph with deeper lines below it becomes a section title, and those lines become its steps. A short paragraph entirely in bold is read as a title too, numbered or not.

A bench sheet table whose columns are `#`, `STEP` and `DONE` becomes a numbered list of steps rather than a three column table.

- **Plain text**: type or paste lines. A line starting with `I.`, `II.` is a chapter, `a.`, `b.` a section, and other lines are steps. Lines separated by tabs become a table.

Seal renumbers everything, so the original numbers (`1.`, `a)`, bullets) are dropped. Values with units turn blue, em dashes become commas, and superscripts such as 10⁶ are kept.

[`examples/example-protocol.docx`](examples/example-protocol.docx) is a made-up protocol to try the import.

## Editing the result by hand

The preview is editable. Select text in it and use the toolbar:

- **Value** puts the selection in blue bold, Seal's own markup for a value to respect (Ctrl+Shift+V).
- **B** for reagents, equipment and warnings (Ctrl+B).
- **I** for remarks and tips (Ctrl+I).
- **Clear** removes formatting from the selection.

A button that is already on removes the format instead of adding it. You can also correct the wording in the preview.

**Up** and **Down** move the line the caret sits in between chapter, section and step. Everything is renumbered, so a step promoted to a section takes the next free letter.

## Experiment

The Experiment tab is for a procedure you already have written somewhere. Fill in the protocol ID, the date and the operator, paste your text under *What was done*, and add what changed on the day under *Deviations and notes*.

The mice and the volumes used are pasted straight from Excel or Word: a header line, then one line per row, columns separated by tabs. They come out as Seal tables.

Chapters your pasted text already has (`I.`, `II.`) are kept; a plain list of steps becomes a chapter called Procedure.

## Copy into Seal

*Copy for Seal* puts two versions on the clipboard: the HTML, with the exact markup Seal keeps, and a plain text version for anywhere that takes no formatting. Paste into a Seal protocol or experiment with Ctrl+V.

Where the browser refuses clipboard access, for example on a page served without https, the app falls back to selecting the preview and copying it.

## Tests

The HTML builder has unit tests that run with Node.js 18 or later, without installing anything:

```sh
npm test
```

## Privacy

No server is involved. The app never sends protocols, experiment data or panels anywhere. The repository contains only made-up examples; please do not commit real lab material.

## Licence

MIT, see [LICENSE](LICENSE).

Third-party code: [mammoth.js](https://github.com/mwilliamson/mammoth.js) 1.12.0 (BSD 2-Clause), in `vendor/` with its licence.
