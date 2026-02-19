# Architecture Notes

This document captures non-obvious decisions that can look strange at first glance but are intentional.

## 1) Why `window.location.href` after auth transitions?

Used in auth-adjacent flows (login/register/logout redirects).

Reason:
- A full-page navigation forces the request through Next middleware, which re-reads auth cookies and applies route guards consistently.
- Client-only `router.push()` can race with cookie/session propagation, causing occasional stale auth state during navigation.

Tradeoff:
- Slightly heavier than SPA navigation.
- More predictable auth boundary behavior.

## 2) Why `onAuthStateChange` callbacks must stay synchronous?

Supabase auth listeners should not `await` inside the callback.

Reason:
- Awaiting inside the listener can block/churn internal auth state handling and create subtle ordering issues (double updates, stale state windows, redirect races).
- Safer pattern: update local state synchronously in callback, run async follow-ups elsewhere.

Pattern used:
- Callback: set React state only.
- Async work: done outside callback or in separate effects/functions.

## 3) Why middleware uses cookie `getAll`/`setAll` bridge?

In `src/lib/supabase/middleware.ts`, Supabase server client is wired with:
- `cookies.getAll()` from request
- `cookies.setAll(...)` writing to both request and response

Reason:
- Supabase SSR needs to read and refresh auth cookies.
- Writing refreshed cookies only to response is insufficient for the current request lifecycle; request-side cookie mutation keeps middleware/server logic coherent in the same pass.

Tradeoff:
- Slightly verbose boilerplate.
- Correct session refresh behavior across protected routes.
