# 06 — Voice and feedback

## Voice

typeover speaks to its learner as a **competent engineer learning a new
language**, not as a novice learning to code. The voice is **warm and
encouraging where it helps**, **dry and witty where it earns a smile**,
and **technical and direct everywhere else**.

The learner can already:

- Write working code.
- Read a stack trace, debug, infer what unknown syntax probably does.
- Survive a code review.

They cannot yet:

- Reach for the idiomatic Go pattern unprompted.
- Read Go quickly without translating in their head.

Voice should treat that gap honestly. We don't fawn over success; we
don't condescend on failure. We don't gamify with "Streak: 3!" or "You
got 5 in a row!". We respect time.

## Copy patterns

### Headings and prompts

- **Do:** "Translate this TS to idiomatic Go."
- **Do:** "Pick the equivalent Go function signature."
- **Don't:** "Are you ready to learn about Go functions? 🚀"

### Correct-answer feedback

- **Do:** "Correct. Idiomatic."
- **Do:** "Correct — and your version compiles, but the canonical form uses `errors.Is`. Worth a look."
- **Don't:** "Awesome job! ⭐"
- **Don't:** "Perfect!" (it's never perfect; it's correct).

### Incorrect-answer feedback

- **Do:** "Not quite. Want a hint, a different exercise, or the diff?"
- **Do:** "This compiles, but you'd get heckled in code review. Common mistake."
- **Don't:** "Oops! Let's try again. 😅"

### Hint copy

- Conceptual hint: *"In Go, multiple return values are a tuple, not a
  union. Both values are always returned."*
- Structural hint: *"The return type is `(string, error)`. Both must
  appear at the call site."*
- Near-answer hint: *"`func parse(s string) (int, error) { ... }`."*

### Voice when introducing new concepts (no TS analogue)

When we hit Go-native ground (goroutines, defer, channels), we drop the
translation crutch. The voice becomes Go-docs-like:

> "Goroutines are functions that run concurrently with the caller.
> Start one with `go fn()`. The caller doesn't wait for it to finish."

Plain. No cheerleading.

## Feedback UX

### On submission

The learner submits an answer. Three outcomes:

1. **Correct.** A small confirmation line. The "next" button is
   highlighted; the "another" button is also visible. The canonical
   answer is **not** auto-shown — there's a "show canonical" button if
   the learner wants to compare.

2. **Incorrect.** No diff shown. The learner is given three buttons:
   - **Try again** — same exercise, same instance, fresh input.
   - **Try a different exercise** — generator yields a new instance.
   - **Reveal diff** — show submission vs canonical, highlight the
     divergence. Marks the exercise as failed for this instance (but
     not for the theme — they can keep going).

3. **Compile error / runtime error** (freeform only). Show the error
   verbatim. Treated like incorrect, same three-button choice. The
   error itself is feedback.

### Hint system

A single **"Hint"** button on every exercise. Clicking once reveals the
conceptual hint. Clicking again reveals the structural hint. A third
click reveals the near-answer.

- Each click is recorded internally (for future gamification, if
  needed) but **never penalises the learner visually**. There is no
  "hint cost" or "score reduction." The point is to teach, not to
  judge.
- Hints reset between instances. Asking for hints on instance #1 of an
  exercise doesn't pre-reveal them on instance #2.

### Canonical-answer reveal

A persistent **"Show canonical"** button, available before and after
submission. Reveals the canonical form with a short explanation. Never
auto-shown except inside a "reveal diff" view.

The canonical answer is always idiomatic Go. If a submission compiles
but is unidiomatic, we mark it as a *pass with note*, not a fail.

## Why this works

The combination — peer-level voice, learner-controlled reveals,
no-cost hints, no fail-punishment — does two things:

1. **Lowers the cost of attempting.** A learner can submit a half-baked
   guess knowing the worst case is "reveal diff," which is the
   single-highest-information outcome.
2. **Keeps the signal honest.** Because hints and reveals don't penalise,
   we can show the learner a stat ("you've used hints on 60% of
   exercises in this theme") without manipulating their behaviour. It's
   information, not gamification.
