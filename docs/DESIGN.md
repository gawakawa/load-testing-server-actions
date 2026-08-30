# Design

## Question

Can Next.js Server Actions be load-tested like a regular HTTP endpoint?

## Server Action wire protocol

Unlike a REST endpoint, a Server Action has no dedicated URL. It's identified by an
**action ID** that's part of the build output and, per the [Next.js Server Actions
guide](https://nextjs.org/docs/app/guides/server-actions), rotates on every new
deployment — and at least every 14 days even when the source is unchanged. A load
test script can't hardcode it; the ID has to be scraped from a live page at run time.

Every action request is a `POST` to the page that renders the action, with two
possible shapes depending on the call site:

|              | no-JS fallback (progressive enhancement)                         | JS dispatch (real user click)    |
| ------------ | ---------------------------------------------------------------- | -------------------------------- |
| Content-Type | `multipart/form-data`                                            | `text/plain;charset=UTF-8`       |
| Identifier   | hidden `<input name="$ACTION_ID_<hash>">` field in the form body | `Next-Action: <hash>` header     |
| Body         | the form fields                                                  | arguments, JSON/Flight-encoded   |
| Response     | re-rendered HTML                                                 | `text/x-component` Flight stream |

Next.js also enforces a CSRF check: the request's `Origin` must match `Host` (or
`X-Forwarded-Host`), so a load test must set `Origin` explicitly.

Note: the docs describe Server Actions as dispatched "one at a time" from a given
client. That's a property of the browser-side dispatcher (it won't fire two actions
concurrently from one tab), not a server-side concurrency limit — it doesn't affect
load testing from many independent virtual users.

### Confirmed against this repo's fixture

`app/page.tsx`'s `increment` action takes no arguments, so it renders the simple
`$ACTION_ID_<hash>` hidden input rather than the encrypted `$ACTION_REF_*`/`$ACTION_KEY`
form used for actions with bound closure variables. Verified against a production
build (`pnpm build && pnpm start`):

```
$ curl -s localhost:3000 | grep -oE '\$ACTION_ID_[A-Za-z0-9]+'
$ACTION_ID_0069ecf5384ade8ce40fbb32cd554c9056738d5fad
```

Both request shapes were replayed by hand and both incremented the counter:

```sh
# no-JS fallback
curl -X POST localhost:3000/ -H "Origin: http://localhost:3000" \
  -F '$ACTION_ID_0069ecf5384ade8ce40fbb32cd554c9056738d5fad='

# JS dispatch
curl -X POST localhost:3000/ -H "Origin: http://localhost:3000" \
  -H "Accept: text/x-component" \
  -H "Next-Action: 0069ecf5384ade8ce40fbb32cd554c9056738d5fad" \
  -H "Content-Type: text/plain;charset=UTF-8" --data-raw '[]'
```

`loadtest/server-action.js` uses the JS-dispatch shape — it's what a real user
interaction produces, and its body doesn't need multipart encoding.

If the fixture ever grows arguments and starts rendering the encrypted closure form
instead, the alternative is to move the action to a module-scoped `app/actions.ts`
export, which always uses the plain `$ACTION_ID_*` id form.

## Tool: k6 vs Locust

|                                | k6                                                                                                                                                                                           | Locust                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| nixpkgs                        | `pkgs.k6` 2.0.0, single Go binary                                                                                                                                                            | `python313Packages.locust` 2.46.3, needs a Python toolchain                                    |
| Cost to add here               | one line in `nix/devShells.nix`                                                                                                                                                              | Python interpreter + a formatter/linter this repo doesn't have (treefmt only covers Nix/oxfmt) |
| Script language                | JS — same formatter (`oxfmt`) as the app                                                                                                                                                     | Python                                                                                         |
| Interaction with type checking | `.js` files fall outside `tsconfig.json`'s `include` (`**/*.ts`/`.tsx`/`.mts` only), so `oxlint`'s type-aware check and the `pnpm-lock.yaml`/`nix/node-modules.nix` hash never need touching | n/a                                                                                            |
| Rotating action ID             | `setup()` runs once, its return value is shared read-only by every VU — fits fetching the ID once per run                                                                                    | would need custom `on_start`/event wiring                                                      |
| CI signal                      | `thresholds` fail the run with a non-zero exit code                                                                                                                                          | pass/fail has to be scripted separately                                                        |
| Single-node throughput         | higher (goroutines)                                                                                                                                                                          | lower (greenlets)                                                                              |

Locust's advantages — Python ecosystem, a live web UI, built-in distributed mode —
aren't relevant here: this is one `next start` process on localhost. **Decision: k6
only.** Locust is left as this comparison, not implemented.

## Verification: the counter oracle

`app/page.tsx` keeps an in-memory `actionCount` and renders it. A `200` response
alone doesn't prove the action ran — the page could be served from cache. Reading
the counter before and after a run isolates that:

```
before: 2
$ k6 run --vus 5 --duration 5s loadtest/server-action.js
...
iterations.....................: 2788   556.254901/s
after: 2790
```

`2790 - 2 == 2788`, matching the iteration count exactly. This confirms the load
test is driving real executions of the Server Action, not just hitting a cache.

## Out of scope

- `nix flake check` does not run k6: the build sandbox has no network access and no
  running server. It stays a manual/dev-shell workflow.
- k6's `browser` module (Chromium-driven, still experimental) — the DevTools capture
  above already confirms a real click produces the same request the script sends.
- Locust implementation.
- `actionCount` lives in one process's memory, so this only validates a single
  `next start` instance, not a multi-instance deployment.
