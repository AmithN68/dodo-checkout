# Dodo Checkout — a tiny embeddable checkout

A merchant embeds this with one script tag and one call:

```html
<script src="https://checkout.example.com/dodo-checkout.js"></script>
```

```ts
window.DodoCheckout.open({
  productId: "prod_123",
  onSuccess: ({ sessionId }) => {},
  onClose: ({ reason }) => {},
  onError: ({ code, message }) => {},
});
```

Card details are entered inside an iframe the SDK creates and owns — they
never touch the merchant's page or its DOM. Payment is faked entirely in the
browser using the three test cards below; there is no server.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173  — demo store
npm run build    # type-checks, builds the SDK bundle, then the app → dist/
npm run preview
```

`npm run dev` / `npm run build` first run `build:sdk` automatically (via
`predev`/`prebuild`), which compiles `src/sdk/DodoCheckout.ts` into a
standalone `public/dodo-checkout.js`. That file is what a real merchant
would actually drop into their site — the demo store loads it the same way,
via a plain `<script>` tag, not an import from the app's own bundle.

### Deploying

This is a static build (no server, no env vars) — `npm run build` produces
`dist/`, which is deployable as-is to Vercel/Netlify/GitHub Pages/any static
host. On Vercel/Netlify: build command `npm run build`, output directory
`dist`. Because both `index.html` and `checkout.html` are real entry points
in `dist/`, no rewrite rules are needed for `/checkout.html` to resolve.

- `/` — the demo store ("Home"), a pretend merchant page
- `/checkout.html` — the checkout app, opened by the SDK inside an iframe
  (can also be opened directly for development)

## The three pieces, and how they talk

```
┌─────────────────────┐        ┌──────────────────────┐        ┌───────────────────────┐
│   Demo store (/)     │        │   SDK (dodo-checkout.js)      │   Checkout (/checkout.html) │
│   "any website"       │───────▶  window.DodoCheckout.open() │───────▶  iframe, own document      │
│   Buy button, log     │◀───────  onSuccess/onClose/onError │◀───────  postMessage              │
└─────────────────────┘        └──────────────────────┘        └───────────────────────┘
```

1. **The demo store** calls `window.DodoCheckout.open({ productId, onSuccess, onClose, onError })`.
2. **The SDK** creates a dimmed backdrop and an iframe pointed at
   `/checkout.html?checkoutId=...`, locks page scroll, and starts a 10s
   load-timeout. It never talks to the merchant's callbacks directly from
   iframe data — every inbound `postMessage` is checked against the iframe's
   `contentWindow` (source) and the checkout's own origin before it's
   trusted, then translated into exactly one of `onSuccess` / `onError` /
   `onClose`.
3. **The checkout app** accepts `DODO_CHECKOUT_INIT` from any origin — it's a
   public, embeddable widget, so it checks that the message's `event.source`
   is literally its own `window.parent` (not spoofable) rather than
   whitelisting an origin the merchant couldn't be expected to be on. It
   remembers that INIT's `event.origin` as the merchant's real origin, and
   every reply after that (`READY`, `PROCESSING`, `SUCCESS`, `ERROR`,
   `CLOSE`) is targeted at that captured origin specifically — never
   assumed, never broadcast.

The demo store's sidebar renders a live callback log (newest first, one
entry per `onSuccess`/`onError`/`onClose`) so the three callbacks are
visibly firing without opening devtools — each one is also mirrored to
`console.info`/`console.error` for anyone who prefers that.

The checkout app is a genuinely separate deployment from the merchant site;
the SDK's iframe URL is just a constant (`CHECKOUT_URL` in
`src/sdk/DodoCheckout.ts`) that defaults to same-origin (`/checkout.html`) so
this repo ships as one deployment, but pointing it at a different domain
requires no protocol changes — both sides already validate the *other's*
origin/source rather than assuming they match.

## Test cards

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declines |
| `4000 0000 0000 0341` | Fails once, then succeeds on retry |

The fake payment (`src/services/fakePayment.ts`) adds ~900ms of latency so
the "Processing…" state is actually visible, and checks `navigator.onLine`
so going offline mid-checkout produces a real error instead of a fake success.

## The weird states this handles

- **Double-clicking Buy**: the SDK ignores a second `open()` while one
  checkout is already active — no second iframe, no second session.
- **Payment declines/fails**: the checkout shows the error inline and stays
  open so the customer can retry (`onError` fires, `onClose` doesn't) —
  a failed card isn't the same as the customer abandoning checkout.
- **Retry-then-succeed card**: tracked per `checkoutId`, so a second attempt
  in the same session succeeds while a fresh session starts over.
- **Checkout iframe fails to load / never responds**: a 10s timeout and an
  `iframe.onerror` handler both resolve to `onError` + `onClose({reason:
  "error"})` — the host is never left waiting forever.
- **Unknown `productId`**: the checkout renders an explicit "couldn't load
  this product" state instead of a blank or broken form.
- **Closing mid-payment**: the close button, Escape, and the SDK's own
  Escape handler are all disabled while a payment is in flight, so a stray
  keystroke can't drop a submitted card.
- **Every terminal state reaches the host**: success, decline/error, and
  close are always one of the three callbacks — nothing fails silently.

## Two decisions I went back and forth on

**1. Same-origin single deployment vs. two real origins for the demo.**
A real integration has the checkout hosted on its own domain, entirely
separate from the merchant's. I chose to ship the checkout as a second HTML
entry point on the *same* origin as the demo store instead, because standing
up two real domains just for a demo adds hosting complexity without changing
anything that matters functionally — the SDK already treats the checkout as
untrusted and cross-origin (origin + source checks on every message, a single
`CHECKOUT_URL` constant it never assumes same-origin), so pointing it at a
real second domain later is a one-line config change, not a rewrite.

**2. Full-screen takeover vs. a centered modal over a dimmed backdrop.**
The first pass rendered the checkout iframe edge-to-edge, like a hosted
redirect page. I switched to a centered card over a dimmed, non-interactive
backdrop of the host page, because the whole point of an embedded checkout
is that the customer *never leaves the page they were on* — a full-screen
white takeover visually says "you've navigated away," which undersells the
thing that actually makes this checkout worth using.

## What I'd explore next

- **Focus trapping** inside the checkout iframe (currently the first field
  is auto-focused, but focus can still Tab out to the host page).
- **A real second origin** for the checkout in the deployed demo, to prove
  the cross-origin story end-to-end rather than by code inspection.
- **`frame-ancestors` / CSP** on the checkout so it can only be embedded by
  domains Dodo has actually issued it to.
- **Card brand detection and inline field validation** (currently validation
  only runs on submit).
- **Automated tests** for the postMessage protocol and the retry/decline
  logic in `fakePayment.ts` — right now this has been exercised manually
  against all three test cards, but there's no regression net.
