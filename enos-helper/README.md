# enos Helper

A Chrome extension that gets you where you work in enos in one click: shortcuts that replay your own clicks, a Ctrl K finder and your recent views. It only runs on malaghan.poweredbyenos.com, in your own browser: it never writes to enos and sends nothing anywhere.

## Install (2 minutes)

1. Download `enos-helper-0.1.0.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `enos-helper` folder.
4. Open enos. A small **enos Helper** tab sits at the bottom left; click it, or press **Ctrl .** (⌘ . on a Mac), to open the sidebar. **Ctrl K** opens the finder.

To update: replace the folder with the new one, then click the reload arrow on the enos Helper card in `chrome://extensions`, and reload the enos tab.

## Your first shortcut: Procedures

enos keeps the same address whatever you open, so a shortcut is a path of clicks, not a link. The extension notes your clicks in enos as you go (a click in the left rail starts a new path).

1. Go where you want the usual way: rail **Projects**, the magnifier of your project, **Procedures** in Details.
2. Open the sidebar (Ctrl .) and click **Pin this view**. It shows the steps it noted (`Projects › search on ML-040014 › Procedures`); give it a name, for example `Procedures`, and press Enter.
3. From now on: Ctrl K, type `proc`, Enter. The extension clicks the same steps for you, one after the other, and tells you when it is there.

The same works for a procedure, an animal list, or a saved query: open **Filter Selection** in Projects, pick your filter, pin the view. The finder also lists the entries of the enos menus it can see on the page, including saved filters in a closed Filter Selection menu, so `Ctrl K`, the first letters of a filter, Enter applies it without pinning anything.

**Recent views** lists what you opened lately (breadcrumb and reference, for example `Projects / Procedures / Procedure · ML-2026-0096`); each reopens in one click, and the star beside it pins it.

If a step cannot be found (enos changed, or the view is reached from somewhere else), the replay stops and says which step; open the view by hand once and pin it again.

## Settings (click the extension icon)

- **Sidebar**: drawer (default, a tab at the bottom left), always open (pushes enos to the right; may not fit), or hidden (Ctrl K only).
- **Open the drawer on arrival**, **Ctrl K finder**.
- **Forget all shortcuts and recent views**: they are kept in this browser only.
- **Diagnostic**: copies the page structure and menu labels (no table content, none of your shortcuts) so the extension can be adjusted to enos.

## What it never does

It never clicks Save, Delete or any button for you unless that click is part of a path you pinned yourself; it never fills a form; nothing leaves your browser. Shortcuts and recent views live in Chrome's local storage for this extension.

## Bench

`EH_BENCH_DIR=<temp dir> NODE_PATH=<node_modules with puppeteer> node bench/run.mjs` loads the extension in headless Chrome on `bench/mock.html`, an enos-like page (same address for every view, rail, orange bar, breadcrumb, tables with magnifiers, Details panel), and checks pinning, replay from home and from another view, the finder on a closed Filter Selection menu, a missing step, and the layouts.
