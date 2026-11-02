# Seal Helper

A Chrome extension that makes Seal calmer and easier to read. It only changes how Seal looks in your own browser: it never writes to Seal and sends nothing anywhere.

## Install (2 minutes)

1. Download `seal-helper-0.7.0.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `seal-helper` folder.
4. Open Seal. Click the extension icon (puzzle piece, then pin Seal Helper) to switch each setting on or off.

To update: replace the folder with the new one, then click the reload arrow on the Seal Helper card in `chrome://extensions`.

## What 0.7 does

**Layout**
- **Built for the lab notebook app**: its menu (Overview, Projects, Experiments, Protocols, Inventory, Calculators & files, How to, Lab tree, Seal FAQs, Give feedback) is read exactly and shown in the sidebar; its own menu is hidden so there is one. A **New** button at the top of the sidebar lists what the notebook can create (New experiment, New project, New protocol, New antibody panel…) and presses the notebook's own button, so templates and IDs stay the notebook's job. Each section in the sidebar has a + on hover.
- **Today shows the notebook's real numbers**: experiments in progress, projects (with how many are active), protocol templates, plus what is waiting to be published; the experiment to continue with its real status, recent experiments with Planned / In progress pills, projects as cards with their experiment counts, protocol templates. All of it opens in the notebook.
- **Finds a lab notebook menu from what it shows**, whatever it is built with, and loads Seal's Views and Changes lists by itself (Seal only fills them once their tab is opened), so shortcuts and counts no longer disappear after a reload.
- **Today, a real dashboard**: greeting and date, a big search, four counters (in progress, to publish, published, last 7 days), the record to pick up with the next ones, the lab notebook sections as tiles, a to-publish checklist, the last 7 days as a strip with an activity log, favourites.
- **Know where you are**: back and forward arrows at the top of the sidebar (Alt ← and Alt → too), Today, My work and To publish are part of the browser history, the sidebar says where you are, and a record shows Notebook › Experiments › its ID.
- **Lab notebook in the sidebar**: if your lab's home page in Seal is a notebook app with its own menu (Overview, Projects, Experiments, Protocols, Inventory...), that menu moves into the sidebar. A click opens the section, from anywhere in Seal. On a record, the section it belongs to is highlighted and a « ‹ Experiments » button takes you back to it. The app's own menu is hidden to keep one menu (option in the extension menu); it comes back as soon as Seal Helper is off.
- **New sidebar**: Today, My work, To publish, Inbox, then the lab sections (or, for a lab without a notebook page, **Lab** shortcuts to Seal views) and favourites. Each shortcut opens one of your Seal views: found by its name, or chosen once with the pencil next to it (remembered in this browser). Add your own with Add a shortcut. All views are still there, folded, under All views. Inside a change, the records of that change are listed at the top, same names grouped (×8). Search with Ctrl K (⌘K on a Mac). "Classic Seal" at the bottom brings the usual Seal bar back.
- **Today**: where you left off, what is waiting to be published, what you created, your favourites. The lab guide is one click away.
- **My work** and **To publish**: full pages, filter by name or by type (Experiments, Documents, Projects), changes grouped by day, empty changes hidden.
- **Record header and outline**: the key fields of a record (ID, owner, dates, status) under its title bar, and its headings on the right when the screen is wide enough.

Every line clicks the matching Seal line for you, so opening, rights and publishing stay Seal's own.

**Clean up**
- **Clean documents**: change bars show on hover only, lines of dashes become a thin rule, the first table row reads as a header.
- **Short dates and titles**: no time zone written out on every date (the full date stays in the tooltip); change titles without the repeated number.
- **Info panel closed**: closed when you open a record; open it again whenever you need it.
- **Quieter lists**: empty changes and Untitled or test drafts are dimmed, never hidden.

It runs only on `https://us.platform.seal.run/o/malaghan/*`. If Seal changes a page and a landmark disappears, that setting simply does nothing.
