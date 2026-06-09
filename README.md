# txt2gpx

Type text, place it on a map, transform it, and export a GPX course you can import into Garmin Connect.

The app uses a Hershey single-line font so exported courses follow strokes rather
than font outlines. By default it connects letters with an underline route, which
keeps the Strava/Garmin trace intentional instead of adding random diagonals
between strokes. The underline gap is adjustable in meters.

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

This repo includes a GitHub Pages workflow. Pushes to `main` deploy the app from
the repository root.
