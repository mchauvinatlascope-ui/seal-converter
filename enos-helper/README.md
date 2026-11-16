# enos Helper

A Chrome extension that gets you where you work in enos in one click: shortcuts that replay your own clicks, shown in the orange bar, a Ctrl K finder over the whole enos menu, and your recent views. It only runs on malaghan.poweredbyenos.com, in your own browser: it never writes to enos and sends nothing anywhere.

## Install (2 minutes)

1. Download `enos-helper-0.3.1.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `enos-helper` folder.
4. Open enos and sign in. Your shortcuts appear in the orange bar next to the search box (empty at first: **Pin a view**). **Ctrl .** (⌘ . on a Mac) or the small tab at the bottom left opens the sidebar; **Ctrl K** opens the finder.

To update: replace the folder with the new one, click the reload arrow on the enos Helper card in `chrome://extensions`, then reload the enos tab.

## Your first shortcut: Procedures

enos keeps the same address whatever you open, so a shortcut is a path of clicks, not a link. The extension notes your clicks in enos as you go; a click in the left menu starts a new path, and clicks that lead nowhere (the ≡ toggle, Sign In, notifications, your account menu) are ignored.

1. Go where you want the usual way: left menu **Projects › Management**, the magnifier of your project, **Procedures** in Details.
2. Open the sidebar (Ctrl .) and click **Pin this view**. It lists the steps it noted (`Projects › Management › search on ML-040014 › Procedures`); remove a step with its × if it is not part of the way, give the shortcut a name, for example `Procedures`, and press Enter.
3. From now on: click **Procedures** in the orange bar, or press **Alt 1**, or Ctrl K, `proc`, Enter. The extension clicks the same steps for you, one after the other, and tells you when it is there.

Rows are recognised by their reference (ML-040014), so counters that change from one day to the next do not break a shortcut. If a step cannot be found (enos changed, or the row is not in the list that day), the replay stops and says which step.

## The enos menu, flat

The sidebar lists the whole left menu of enos with its sub-entries, even the ones enos hides until you hover (Projects › Management, Animals › Reports › Queries…). One click opens the entry. The finder (Ctrl K) searches them too, along with the saved filters of an open list (Filter Selection) and your recent views.

## Settings (click the extension icon)

- **Shortcuts in the enos bar** (on by default), **Sidebar**: drawer, always open (pushes enos to the right; may not fit), or hidden; **Open the drawer on arrival**; **Ctrl K finder**.
- **Forget all shortcuts and recent views**: they are kept in this browser only.
- **Diagnostic**: copies the page structure and menu labels (no table content, none of your shortcuts) so the extension can be adjusted to enos.

## What it never does

It never clicks Save, Delete or any button for you unless that click is part of a path you pinned yourself; it never fills a form; nothing leaves your browser.

## 0.3.1

- A shortcut pinned with 0.1 kept « Sign In » as its first step, so opening it went to the home page and stopped. Such steps are now removed from old shortcuts, and a replay that cannot find a step stays where it is instead of going home.
- Steps are recognised by their enos action (ng-click) first, then by their text: a changed label or badge no longer breaks a shortcut; a menu entry is found by its path (Projects › Management) even when the menu is folded.

## 0.3

- **Calm lists** (on by default): long titles on one line (hover to unfold), the bin icon set apart and dimmed, the row under the mouse highlighted. Nothing in the data changes.
- **Records in reading width** (off by default, try it): fields capped at a reading width, empty fields dimmed, file drop zone reduced.
- **This record**: the entries of the Details panel (Species, Active Animals, Procedures…) as buttons in the sidebar, one click even when the panel is off screen.
- **My queries**: the Queries entries of every domain gathered in one list.
- **Back where you were**: on arrival, a small message offers to reopen the last view.

## 0.2

- Shortcuts as buttons in the orange bar, Alt 1 to 9.
- The whole enos menu in the sidebar and the finder, sub-entries included.
- Steps can be removed before pinning; Sign In, the menu toggle and the account menu are never recorded; a click in the left menu starts a new path.
- Rows recognised by their reference rather than by the whole row.
- Diagnostic now reports the content area, the right panel and the menu routes.

## Bench

`EH_BENCH_DIR=<temp dir> NODE_PATH=<node_modules with puppeteer> node bench/run.mjs` loads the extension in headless Chrome on `bench/mock.html`, an enos-like page (sign-in first, same address for every view, orange bar, folded left menu, tables with magnifiers, Details panel on the right), and checks pinning with step removal, replay from the dashboard and from another view by Alt 1 and by chip, the finder on folded menu entries and on a saved filter, a missing step, and the settings.
