# txt2gpx

Type text, place it on a map, transform it, and export a GPX course you can import into Garmin Connect.

The first version uses a Hershey single-line font so exported courses follow strokes rather than font outlines.

## Run locally

```sh
npm run serve
```

Then open <http://localhost:5173>.

If you want a temporary modern Node without changing the machine:

```sh
npx -p node@20 node scripts/smoke.mjs
```

## Publish

This is a static app, so it can be published with GitHub Pages, Cloudflare Pages, Netlify, or any static host.
