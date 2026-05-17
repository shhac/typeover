# 01 — Vision

## What

**typeover** teaches Go to developers who already know TypeScript.

Most Go-learning resources assume zero prior programming knowledge or assume a
C/Java background. There's a large and growing audience that comes from the
opposite direction: years of TypeScript, comfortable with structural typing,
generics, async/await, and a JavaScript-shaped mental model. For them, "learn
Go from scratch" is wasted effort and "read the Go tour" is too shallow.

typeover meets that audience where they are. Every concept is introduced as a
**translation** from TypeScript: here is the TS you'd write, here is the Go,
here is what changes and why.

## Who

The target learner:

- Writes TypeScript daily (frontend, backend, or both).
- Understands generics, narrowing, structural typing, async patterns.
- Wants to ship Go in the next 3–6 months (a new service, a CLI, a side
  project).
- Has tried "A Tour of Go" and bounced off — it teaches Go but doesn't connect
  the dots from what they already know.

## Why this, why now

- The TS-to-Go pipeline is real and growing. Microsoft is rewriting `tsc` in
  Go. Many JS-flavoured startups are reaching for Go for backend services
  where Node hits limits. The audience exists.
- No existing resource takes the "bilingual phrasebook" approach. Closest
  thing is scattered blog-post comparisons; nothing structured and
  exercise-driven.
- Browser-based Go execution (Yaegi compiled to WASM) just became practical.
  Exercises can run instantly, no server roundtrip, no compile step.

## Shape of the product

- A static, free, ad-free site.
- Lessons are short (5–10 minutes each), structured as exercise sequences.
- Progress tracked locally first; cloud accounts only if there's demand.
- Open-source content, so the community can extend it.

## Scope

typeover aims to be a **full Go intro**, with TS-translation as the
pedagogical wedge — not just a phrasebook. The bilingual core gets you
through everything that has a TS analogue (types, structs, generics,
interfaces, error returns). Once that scaffold is paying off, the course
continues into the parts of Go that *don't* translate from TS
(goroutines, channels, defer, embedding, project layout, stdlib idioms)
as straight Go content, no longer leaning on the translation crutch.

The audience deliberately isn't split into "backend devs" vs "frontend
devs picking up Go for tooling." The bilingual core serves both; if
either audience proves to need specialised modules (HTTP servers,
CLI design), those become add-ons later.

## Ambition

This is a **portfolio / learning project** for the author. The primary
goal is building it well — optimising for craft, not for launch speed or
audience growth. If it ends up genuinely useful and attracts learners,
great; that doesn't change the build priorities.

## Non-goals

- Not a JS-to-Go tool or transpiler. typeover teaches Go *as Go*; the TS
  scaffold is removed once you don't need it.
- Not aimed at non-typed-JS developers. If you don't know TS, you'll
  understand the Go side fine, but you won't get the value of the
  comparison.
- Not optimising for SEO, monetisation, or growth tactics in v0. Those
  questions can be revisited if the content matures.
