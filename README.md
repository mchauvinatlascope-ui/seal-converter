# seal-converter

A small web app that turns lab protocols, experiment records and antibody mix calculations into HTML that pastes cleanly into the Seal electronic lab notebook.

Seal keeps only its own formatting when you paste, so values, reagents and notes lose their styling unless the HTML uses the exact markup Seal recognises. This app writes that markup for you.

Everything runs in your browser. Files you open and text you paste stay on your computer.

## Status

Work in progress. The Protocol tab already reads a protocol and shows the Seal version; copying to Seal comes next.

| Module | What it will do |
| --- | --- |
| Protocol | Import a .docx or paste text, highlight values with units, copy for Seal |
| Experiment | Same, with a template for the linked protocol, mice, deviations and volumes used |
| Antibody mix | Import a panel from .xlsx and compute mix volumes as a Seal table |

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

- **Word file**: click *Import .docx* or drop the file on the Source panel. Heading styles become chapters and sections, Word lists become steps, tables stay tables, and bold and italic are kept.
- **Paste from Word or a web page**: paste into the empty Source box. The formatting that came with the paste is used the same way.
- **Plain text**: type or paste lines. A line starting with `I.`, `II.` is a chapter, `a.`, `b.` a section, and other lines are steps. Lines separated by tabs become a table.

Seal renumbers everything, so the original numbers (`1.`, `a)`, bullets) are dropped. Values with units turn blue, em dashes become commas, and superscripts such as 10⁶ are kept.

[`examples/example-protocol.docx`](examples/example-protocol.docx) is a made-up protocol to try the import.

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
