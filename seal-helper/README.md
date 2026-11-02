# Seal Helper

A Chrome extension that makes Seal calmer and easier to read. It only changes how Seal looks in your own browser: it never writes to Seal and sends nothing anywhere.

## Install (2 minutes)

1. Download `seal-helper-0.2.0.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `seal-helper` folder.
4. Open Seal. Click the extension icon (puzzle piece, then pin Seal Helper) to switch each setting on or off.

To update: replace the folder with the new one, then click the reload arrow on the Seal Helper card in `chrome://extensions`.

## What 0.2 does

**Layout**
- **New sidebar**: Home, My work, To publish, Inbox, then the lab's lists (your Seal Views) and favourites. Inside a change, the records of that change are listed at the top, same names grouped (×8). Search with Ctrl K (⌘K on a Mac). "Classic Seal" at the bottom brings the usual Seal bar back.
- **Home**: where you left off, what is waiting to be published, what you created, your favourites. The lab guide is one click away.
- **My work** and **To publish**: full pages, filter by name, changes grouped by day, empty changes hidden.
- **Record header and outline**: the key fields of a record (ID, owner, dates, status) under its title bar, and its headings on the right when the screen is wide enough.

Every line clicks the matching Seal line for you, so opening, rights and publishing stay Seal's own.

**Clean up**
- **Clean documents**: change bars show on hover only, lines of dashes become a thin rule, the first table row reads as a header.
- **Short dates and titles**: no time zone written out on every date (the full date stays in the tooltip); change titles without the repeated number.
- **Info panel closed**: closed when you open a record; open it again whenever you need it.
- **Quieter lists**: empty changes and Untitled or test drafts are dimmed, never hidden.

It runs only on `https://us.platform.seal.run/o/malaghan/*`. If Seal changes a page and a landmark disappears, that setting simply does nothing.
