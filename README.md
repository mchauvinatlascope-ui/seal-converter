# seal-converter

A small web app that turns lab protocols, experiment records and antibody mix calculations into HTML that pastes cleanly into the Seal electronic lab notebook.

Seal keeps only its own formatting when you paste, so values, reagents and notes lose their styling unless the HTML uses the exact markup Seal recognises. This app writes that markup for you.

Everything runs in your browser. Files you open and text you paste stay on your computer.

## Status

Early work in progress. In the Protocol tab you can already type or paste steps, one per line, and see values with units turn blue. Word import and copying to Seal come next.

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

## Tests

The HTML builder has unit tests that run with Node.js 18 or later, without installing anything:

```sh
npm test
```

## Privacy

No server is involved. The app never sends protocols, experiment data or panels anywhere. The repository contains only made-up examples; please do not commit real lab material.

## Licence

MIT, see [LICENSE](LICENSE).
