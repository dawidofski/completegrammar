# Deployment — GitHub Pages

Target repo: <https://github.com/<you>/completegrammar> (substitute your own repo).

## Status

- Phase 11 (manifest / service worker / offline) is intentionally **skipped** —
  this is an online-only PWA. No `sw.js` or `manifest.webmanifest` is shipped.
- The app is a static, hash-routed SPA: `index.html` + `css/` + `js/` +
  `data/book.json` + `data/tables/*.jpg`. All asset paths are **relative**, so it
  works from any Pages subpath (no server routing needed).
- `data/book.json` is fetched at runtime and imported into IndexedDB
  (idempotently, keyed on `contentVersion`).

## One-time setup (do once)

1. Create a repo on GitHub named (e.g.) `completegrammar`, then add it as the
   remote and push:

   ```powershell
   git -C c:\wamp64\www\Spanish2 remote add origin https://github.com/<you>/completegrammar.git
   git -C c:\wamp64\www\Spanish2 push -u origin master
   ```

2. Make the repo **public** (required for Pages on the free plan):

   GitHub → repo → **Settings → General → "Danger Zone" →
   Change repository visibility → Public**.

   > ⚠️ This publishes the copyrighted book content (theory, exercises, answers,
   > and the ~752 images in `data/tables/`). Only do this if you accept that
   > public exposure.

3. Enable Pages:

   GitHub → repo → **Settings → Pages** →
   - Source: **Deploy from a branch**
   - Branch: `master`, folder: `/ (root)`
   - **Save**

4. Wait ~1–2 minutes, then open:

   <https://<you>.github.io/completegrammar/>

## Deploying updates

```powershell
git -C c:\wamp64\www\Spanish2 add -A
git -C c:\wamp64\www\Spanish2 commit -m "describe change"
git -C c:\wamp64\www\Spanish2 push origin master
```

Pages rebuilds automatically from `master`. Note: Pages serves the repo root, so
`index.html`, `data/`, `css/`, and `js/` must stay at the repo root (they do).

## Verify (manual self-check)

1. Open the Pages URL in Chrome on Android (or desktop Chrome with device
   emulation).
2. First load: the header shows a **"N / M correct"** progress pill and the
   **Book** list (26 flat chapters) renders.
3. Tap a chapter → an exercise, answer a fill-in-the-blank, tap **Check** →
   expect a green ✓ (correct) or ✗ with **Try Again**.
4. Reload the page → progress is retained (IndexedDB persists per-origin).
5. DevTools → Network → filter `404`: there must be **no** 404 for
   `data/book.json` or `js/vendor/dexie.min.js`.

## Rollback

- Disable Pages: **Settings → Pages → Source → None**.
- Un-publish content: make the repo **private** again (Settings → Danger Zone →
  Change visibility → Private). On the free plan Pages stops serving.
