# Seal Helper

A Chrome extension that makes Seal calmer and easier to read. It only changes how Seal looks in your own browser: it never writes to Seal and sends nothing anywhere.

## Install (2 minutes)

1. Download `seal-helper-1.4.2.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `seal-helper` folder.
4. Open Seal. Click the extension icon (puzzle piece, then pin Seal Helper) to switch each setting on or off.

To update: replace the folder with the new one, then click the reload arrow on the Seal Helper card in `chrome://extensions`.

## If you see no change

Click the extension icon on a Seal tab: the first card says whether Seal Helper is **active on this tab**, **paused**, or whether the tab **needs a reload** after an update (one button does it). After replacing the folder, always press the reload arrow on the Seal Helper card in `chrome://extensions`, then reload Seal. The sidebar shows its version (v1.4.2) at the bottom.

## 1.4.2 fixes

- A record that embeds its own frame (for example the list of protocol templates inside an experiment) was taken for the notebook page: the sidebar sections did nothing from there, and the record bar was missing. Only a frame that carries the lab menu counts as the notebook now.

## 1.4.1 fixes

- From a record, clicking a notebook section brought the notebook home page but not the section: the notebook shows its menu before it listens to clicks. The click is now repeated until the section is active (at most five times).

## What 1.4 adds

- **Keyboard shortcuts** (outside a text field): N new record, T Today, W My work, P To publish, G then the first letter of a notebook section, / search, ? shows the list. Also in the ? menu.
- **Dark mode**: when Seal is dark, the sidebar and pages follow.

## What 1.3 adds

- **Print** in the record bar: the record prints as a clean notebook page, without the Seal panels, drawers and bars (with the Clean documents setting).
- **Records open by their address**: a notebook record whose identifier is a Seal identifier opens directly, without going through the notebook home page first.

## What 1.2 adds

- **Record actions in the bar**: on the right of the bar under the title, the status (click to change it), the version, Edit, the changes of this version, the change set, and the publish or review button when Seal offers one. Each one presses the matching Seal button.

## What 1.1 adds

- **Project in the record breadcrumb**: on an experiment, the bar under the title reads Notebook › Experiments › *Project* › ID; the project opens in one click.
- **Reset menu hiding** in the popup: if an empty column stays on the left of the notebook (a setting learned by an earlier version), press it once and reload Seal.

## 1.0.3 fixes

- The visibility check no longer counts what is below the fold as hidden (the notebook page scrolls): a long table no longer makes the extension change how it hides the menu.

## 1.0.2 fixes

- The way the notebook menu is hidden is learned once and remembered in this browser, never measured while a page is changing, and the menu is never shown again by itself.
- To publish and Today say "Loading your changes from Seal…" until Seal has filled its list, instead of "Nothing waiting".

## 1.0.1 fixes

- A notebook section that showed nothing (Experiments) while the menu was hidden: the extension now checks, after hiding the menu, that the notebook content fills the frame; if not it hides the menu more gently, and as a last resort keeps the menu and says so.
- The popup has a **Diagnostic** button: it copies the structure of the page (no record content) to paste when something looks wrong.

## What 1.0 changes: the sidebar, reorganised

- **Lab notebook first**: Overview, Projects, Experiments, Protocols, Inventory, Calculators & files, with their counts.
- **You**: Today, My work, To publish. Inbox lives on the To publish page (a tab opens your Seal inbox) and as an icon at the bottom.
- **Recent**: the five records you opened last, a coloured dot for their status.
- **Favourites**, then **Seal views**, folded by default with their count.
- **Help moved to the « ? » at the bottom**: How to, Lab tree, Seal FAQs, Give feedback, Seal's own help, and the Getting around card.

## 0.9.2 fixes

- No more flash of the notebook's home page or of its own menu when you open a section or create something: the work area is covered until the notebook shows the result (at most a few seconds), and the hidden menu is hidden by its own structure, even when the notebook redraws it.
- When a New button is not on the notebook view you are in, the notebook's first section is opened first, then the button pressed.

## 0.9.1 fixes

- Clipped text in the sidebar and on Today (descenders cut, lines overlapping): the extension's text no longer inherits Seal's line height.
- Blank notebook section: the hidden menu column kept its height in the notebook's grid and pushed the content below the screen; it is now taken out of the layout entirely.

## What 0.9 adds

- **My work from the notebook**: the experiments and projects of the lab notebook, with their status (Planned, In progress, Active…), filtered by status or by name, each opening in the notebook. A switch shows your recent Seal records instead.
- **Getting around**: a short card on Today with the four moves (New, Ctrl K, arrows, Classic Seal); Got it hides it for good.
- **Last used first**: the New menu puts what you created last at the top of its group, with a small Last used tag.

## 0.8.1 fixes

- The notebook page was squeezed into the width of its hidden menu: the menu column is now collapsed to zero width and the page takes the whole space.
- The sidebar could follow a sideways scroll of the page: it is now anchored to the window and the page no longer scrolls sideways.
- Seal's « Start Here » record (the page that holds the notebook) is recognised as the notebook: the sidebar says *Notebook / Overview*, the sections highlight, no record header is added there.
- **Open on Today** now does what it says on any lab: Today first when you arrive, one click to the notebook. Switch it off in the popup to land on the notebook page.
- Views kept in folded groups are found (the groups are unfolded once in the hidden Seal panel), so *from template* finds Protocols or Projects wherever they are; without such a view it falls back to Seal's own **+ New** list.
- Experiments in progress and projects counted next to their section in the sidebar.

## What 0.8 adds

- **New from a template**: the New menu has two groups. *In the lab notebook* presses the notebook's own buttons (New experiment, New project, New protocol, New antibody panel), each with a one-line hint. *From a Seal template* opens the matching Seal view (Protocols, Projects, Experiments when such a view exists) and its **+ New instance** list, where every template of that type is offered; nothing is created until you pick one.
- **You always see what is happening**: a short message at the bottom says what is being opened ("Opening New experiment…", "Choose a template in the list") and, if a button cannot be found, what to do instead. If reaching the notebook needs a page reload, the action you asked for is replayed after it.
- **Never a blank sidebar**: each part of the page is read on its own, so one unexpected page can no longer stop the sidebar from showing. The extension popup tells you whether it is running on the current tab.
- **Where you are**: inside a Seal view, the sidebar says *View / Protocols*.

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
