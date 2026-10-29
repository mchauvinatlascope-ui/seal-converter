# seal-converter

A small web app that turns lab protocols, experiment records and antibody mix calculations into HTML that pastes cleanly into the Seal electronic lab notebook.

Seal keeps only its own formatting when you paste, so values, reagents and notes lose their styling unless the HTML uses the exact markup Seal recognises. This app writes that markup for you.

Everything runs in your browser. Files you open and text you paste stay on your computer.

## Status

Protocols and experiments convert and copy into Seal. The antibody mix calculator works for the volumes; FMO tubes and the order of addition are still to come.

## Use it

Open the hosted version: https://mchauvinatlascope-ui.github.io/seal-converter/

To run it locally, clone the repository and open `index.html` in a browser. There is no build step and nothing to install.

```sh
git clone <repository-url>
cd seal-converter
open index.html   # or double-click the file
```

## Convert a batch of documents

Drop your files on the Documents panel, or click *Add files*. A whole folder works too, through *Add a folder* or by dropping it: subfolders are followed, and anything that is not a document is skipped. Word (.docx), a saved or exported web page (.html) and plain text (.txt) all work, and *Or paste a document* takes a paste from Word, SharePoint or a web page.

*Leave out the title block* drops what sits before the first heading, the document name, its reference and its version, which Seal records itself. Untick it to keep them. Changing it converts the list again.

*Convert all* reads and converts everything in the list at once and takes you to the first document that needs attention, so a batch can be triaged before you start pasting.

Click a document to see its Seal version, correct anything that needs it, then *Copy for Seal* and paste into Seal. Copying ticks the document off and *Next document* moves you to the first one still to do, so a long migration stays easy to follow. Corrections you make in the preview are kept when you switch documents.

What the reader does with a document:

- Word heading styles, `<h1>`..`<h6>`, and short paragraphs entirely in bold become chapters and sections.
- Lists become steps. A list item or an indented paragraph with deeper lines below it becomes a section title, and those lines its steps.
- Headings numbered `1.`, `2.`, `3.` through the document become chapters, and their sub numbers (`5.1`, `5.2`) sections. Steps that start with a number are left alone, because their numbering restarts in every part.
- In plain text, `I.`, `II.` also mark chapters, `a.`, `b.` sections, and a short line with no value, no final punctuation and no action verb at the start is read as a section. Tab separated lines become a table.
- A bench sheet table whose columns are `#`, `STEP` and `DONE` becomes a numbered list of steps.
- Values with units turn blue, em dashes become commas, superscripts such as 10⁶ and 4 °C are kept, and the original numbering is dropped because Seal numbers everything again.

The list survives closing the tab: the documents already converted, your corrections and the ticks come back next time, held in this browser alone and never sent anywhere. *Clear the list* empties it. A document whose text was too heavy to keep is listed again but needs its file a second time.

## Nothing lost without saying so

After each conversion the app compares the document with its Seal version and warns above the preview when something did not come through: a passage that is nowhere in the result, a document that came out with no step at all, or a picture stored outside the file. A dot next to the name in the list marks the documents worth a second look.

Numbering, bench sheet tick columns and the tags Word scatters through a sentence are ignored, so a warning means real content, not formatting.

## Pictures

Pictures are kept. An image in a Word file travels inside the copied HTML, so it reaches Seal with the text; an image in a web page is kept when it is embedded in the page or available at a public address.

Seal decides what it does with a pasted picture, so try one before converting a whole protocol: if Seal drops it, add the file in Seal as an attachment and keep the text from here.

## Editing the result by hand

The preview is editable. Select text in it and use the toolbar:

- **Value** puts the selection in blue bold, Seal's own markup for a value to respect (Ctrl+Shift+V).
- **B** for reagents, equipment and warnings (Ctrl+B).
- **I** for remarks and tips (Ctrl+I).
- **Clear** removes formatting from the selection.

A button that is already on removes the format instead of adding it. You can also correct the wording in the preview.

**Up** and **Down** move the line the caret sits in between chapter, section and step. Everything is renumbered, so a step promoted to a section takes the next free letter.

## Antibody mix

Open a panel from .xlsx, or paste it from Excel with the header line first. The only column the calculator needs is the dilution, written `1:200`, `1/200`, `200` or `0.005`; channel, fluorochrome, marker, clone, supplier and catalogue number are carried through to the table when they are there.

Set the number of samples, the excess and the volume per test, and the preview gives the panel, the master mix and the single stains as Seal tables. The rules are the ones from the lab spreadsheet:

| Quantity | Rule |
| --- | --- |
| Volume per test | `Vf`, 100 µL by default |
| Total volume | `tests × Vf`, where tests = samples plus the excess |
| Brilliant Stain Buffer | `Vtotal / 2` |
| Each antibody | `Vtotal / dilution` |
| PBS | `Vtotal − BSB − sum of the antibodies` |
| Single stain | `Vf / dilution` |

FMO tubes and the order the reagents go in are not in yet.

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

Third-party code in `vendor/`, each with its licence: [mammoth.js](https://github.com/mwilliamson/mammoth.js) 1.12.0 (BSD 2-Clause) reads Word files, [SheetJS](https://sheetjs.com) 0.18.5 (Apache 2.0) reads workbooks.
