# enos Helper

A Chrome extension that gets you where you work in enos in one click. It gives enos a **Home** (your pinned views, your last views, your queries and the whole enos menu on one page), shortcuts in the orange bar that replay your own clicks, and a Ctrl K finder. It only runs on malaghan.poweredbyenos.com, in your own browser: it sends nothing anywhere.

## Install (2 minutes)

1. Download `enos-helper-1.0.2.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped `enos-helper` folder.
4. Open enos and sign in. The first time, three steps explain the star. Then **Home** opens in place of the empty enos home page.

To update: replace the folder with the new one, click the reload arrow on the enos Helper card in `chrome://extensions`, then reload the enos tab. Your pinned views are kept.

## Home

Home opens when you arrive in enos, and any time from the **Home** button in the orange bar (Esc or the × closes it and shows enos as usual).

- **Pinned views**: one card each, with the path it follows and its keyboard shortcut (Alt 1 to 9). Click to open, drag to reorder, the star at the top right unpins, right-click renames or moves.
- **Pick up where you left off**: your last views; the star pins one.
- **My queries**: the queries and saved filters you pinned, by name, and a link to each query list of enos.
- **All of enos**: the whole left menu with its names, sub-entries included, one click each.
- At the bottom: **Save my pinned views to a file** and **Load from a file**, to keep a copy or move them to another computer.

## Your first pinned view: Procedures

enos keeps the same address whatever you open, so a pinned view is a path of clicks, not a link. The extension notes your clicks in enos as you go; a click in the left menu starts a new path, and clicks that lead nowhere (the ≡ toggle, Sign In, notifications, your account menu) are ignored.

1. Go where you want the usual way: left menu **Projects › Management**, the magnifier of your project, **Procedures** in Details.
2. Click **★ Pin this view** in the orange bar. A small window proposes a name and shows the path it will follow (**Edit steps** lets you drop a click that is not part of the way). Enter pins.
3. From now on: its card on Home, its button in the orange bar, **Alt 1**, or Ctrl K, `proc`, Enter. A banner at the bottom shows the steps as they go (**Stop** halts it), and a message says when it is there.

Rows are recognised by their reference (ML-040014), so counters that change from one day to the next do not break a pinned view. If a step cannot be found (enos changed, or the row is not in the list that day), it stops and says which step.

## Finder (Ctrl K)

Type a few letters: your pinned views, your recent views, the entries of the enos menu (even folded ones) and what the open page offers (the saved filters of a list, the entries of Details), each under its heading. Enter opens; Ctrl Enter pins a recent view.

## Settings (click the extension icon)

- **Open Home**, **Find**.
- **Calm tables** (on): one line per row, the bin kept away from the magnifier. **Readable forms** (off): narrower columns, empty fields toned down. **Start on Home** (on).
- **Save to a file**, **Load from a file**, **Copy a diagnostic** (page structure and menu names only: no table content, none of your shortcuts), **Forget everything**.

## What it never does

It never clicks Save, Delete or any button for you unless that click is part of a path you pinned yourself; it never fills a record. The one thing it types is the list filters you had typed yourself when you pinned a view through a list row (then presses Search). To greet you on Home it reads your first name where enos shows it at the top right; it is kept nowhere. Nothing leaves your browser.

## 1.0.2

- **Unpin**: each card on Home has its star at the top right; click it to unpin (the message offers Undo). Right-click still renames or moves.

## 1.0.1

- **Home and your enos dashboard on one page**: on the enos home page, Home now sits above your enos widgets (your query results) instead of covering them. The enos menu is folded there (**Show the menu**). From any other view, the Home button still opens Home over the page, with a link to the enos dashboard.
- Home shows every time you come back to the enos home page, sign-in included (the address is `#/home`).
- **Pin a menu entry from Home**: a star next to each entry of All of enos (Locations › Records, Animals › Selection, Cages…) pins it without going there. Entries that enos names the same in several menus (Selection, Queries) are all listed now, and named after their menu.
- « Stopped at step 2 (form) »: a click in a filter box or in the filter area was noted as a step. It no longer is, and such steps are removed from the views you already pinned.
- Ticking a box is a step that remembers the state you wanted: a box already ticked is left as it is.

## 1.0

- **Home**: a dashboard in place of the empty enos home page (pinned views as cards, last views, My queries, the whole enos menu), with a **Home** button in the orange bar.
- A new look, in the Atlascope family; buttons in the orange bar are now white and readable.
- **Pin this view** shows the path as a trail and says which list filter it remembers.
- A banner follows a pinned view while it opens, with a **Stop** button; a view pinned through a filtered list opens about 3 seconds faster.
- The finder groups its results (Pinned, Recent, enos menu, On this page) and Ctrl Enter pins a recent view.
- **Save / Load** your pinned views as a file.
- A three-step introduction on first install.
- The side drawer is no longer shown (Ctrl . still opens it).

## 0.4.1

- A shortcut through a list row (your project in Projects) stopped when the list did not show that row any more: enos lists depend on the filters typed above them (Reference `*ml*`, a status) and on the Search button, and typing is not a click. The filters filled in when you pin are now noted with the shortcut; at replay, if the row is not there, they are put back, Search is pressed, and the list gets up to 15 seconds to load. This is the only case where the extension types into enos: list filters, with the values you had typed yourself.
- A row is also recognised by any cell that carries its reference.

## 0.4

- **Pin from the bar**: the ★ in the orange bar pins the current view in a small window (name proposed, clicks listed, × removes one, Enter pins). No sidebar needed for the everyday flow.
- **Right-click a shortcut** in the bar to rename, move left or right, or remove it.
- Shorter proposed names: `Procedure ML-2026-0096`, `Procedures`, `Projects`.
- A one-time hint after your first navigation: pin the view you use often.
- The small tab at the bottom left is hidden while the bar shows the shortcuts (Ctrl . still opens the sidebar).

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
