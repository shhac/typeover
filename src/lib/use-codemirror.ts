import { createEffect, onCleanup, onMount, type Accessor } from "solid-js";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/*
 * Shared Solid-side CodeMirror lifecycle helper.
 *
 * Why this exists: three editor surfaces in this codebase — the
 * freeform editor (CodeMirrorEditor), the fill-blanks scaffold
 * (CodeMirrorFillBlanks), and the single-line blank input
 * (BlankInput) — each used to maintain their own
 * `let view; onMount → EditorState.create → new EditorView →
 * onCleanup(view.destroy())` plus the same value-sync createEffect
 * (when controlled) and editable-compartment createEffect (when
 * toggle-able). Lens 4's pattern-dedup analysis flagged this as
 * "3 call sites, same skeleton, drift waiting to happen."
 *
 * Each surface still owns its full extension list (theme, language,
 * keymaps, decorations, etc.) — that's the part that legitimately
 * varies. What the hook owns is the lifecycle (mount, cleanup,
 * value-sync guard, editable-toggle dispatch).
 *
 * Test-env: callers that need a non-CodeMirror DOM under jsdom
 * (because contentEditable is brittle there) still bifurcate
 * ABOVE this hook — they call `useCodeMirror()` only on the
 * production branch. The hook deliberately doesn't try to know
 * about `isCodeMirrorTestEnv()` since each surface's fallback
 * shape (textarea, span tree, plain input) is different.
 */

export interface UseCodeMirrorOpts<L extends string = string> {
  /** Accessor for the parent DOM element. Solid refs populate
   *  AFTER the first render, so a function is the safe shape. */
  parent: Accessor<HTMLElement | undefined>;
  /** Initial document text. Captured once at mount; further
   *  changes flow through the optional `value` accessor below. */
  initialDoc: string;
  /** Build the full extension list. Called once at mount; the
   *  `editableCompartment` and `languageCompartment` are supplied
   *  so callers can include them in the list to let the hook
   *  toggle editability and swap the language grammar later
   *  without rebuilding the view. */
  buildExtensions: (compartments: {
    editableCompartment: Compartment;
    languageCompartment: Compartment;
  }) => Extension[];
  /** If provided, the hook syncs incoming `value()` into the
   *  doc whenever it changes — skipping when current === incoming
   *  to avoid cursor-jump loops with the editor's own update
   *  listener. Omit for static / read-only editors. */
  value?: Accessor<string>;
  /** If provided, the hook reconfigures the `editableCompartment`
   *  whenever `editable()` changes. Caller must include
   *  `editableCompartment.of(EditorView.editable.of(initial))` in
   *  the extension list for the toggle to take effect. */
  editable?: Accessor<boolean>;
  /** If provided, the hook async-loads the language extension via
   *  `loadExtension(lang)` whenever the language changes and
   *  reconfigures `languageCompartment`. Caller must include
   *  `languageCompartment.of([])` in the extension list so the
   *  view mounts with an empty placeholder; the grammar lands
   *  via a dispatch once the dynamic import resolves. Lazy-loads
   *  the per-language grammar so each ships in its own chunk —
   *  the three grammars together exceed 300 KB minified, so this
   *  is load-bearing for bundle size. */
  language?: {
    accessor: Accessor<L | undefined>;
    loadExtension: (lang: L) => Promise<Extension>;
  };
  /** Called once after the view is mounted. Use it to build any
   *  imperative ref handle the caller wants to expose (e.g. focus,
   *  insertAtCursor). */
  onView?: (view: EditorView) => void;
}

export function useCodeMirror<L extends string = string>(opts: UseCodeMirrorOpts<L>): void {
  let view: EditorView | undefined;
  const editableCompartment = new Compartment();
  const languageCompartment = new Compartment();

  onMount(() => {
    const parent = opts.parent();
    if (!parent) return;
    const state = EditorState.create({
      doc: opts.initialDoc,
      extensions: opts.buildExtensions({ editableCompartment, languageCompartment }),
    });
    view = new EditorView({ state, parent });
    opts.onView?.(view);
  });

  /* Sync external value changes into the doc. The `current === v`
   * guard prevents the cursor from jumping to the end every time
   * the parent re-renders (the editor's own update listener fires
   * the same value back up; without the guard, an infinite ping-
   * pong of redundant dispatches would clobber the selection). */
  if (opts.value) {
    createEffect(() => {
      const v = opts.value!();
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === v) return;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: v },
      });
    });
  }

  /* Reconfigure the editable compartment when toggled. The caller
   * must have included the compartment in their initial extension
   * list — without it, this dispatch is a no-op. */
  if (opts.editable) {
    createEffect(() => {
      if (!view) return;
      view.dispatch({
        effects: editableCompartment.reconfigure(EditorView.editable.of(opts.editable!())),
      });
    });
  }

  /* Async-load + reconfigure the language compartment. Each
   * language grammar is dynamic-imported in `cmLanguageExtension`,
   * so the editor mounts immediately with an empty placeholder and
   * the grammar lands once the chunk resolves. Re-fires if the
   * language accessor's value changes mid-life (rare in this
   * codebase but supported). The `generation` guard discards a
   * stale-but-late resolution if the language flipped mid-flight. */
  if (opts.language) {
    let generation = 0;
    createEffect(() => {
      const lang = opts.language!.accessor();
      if (lang === undefined) return;
      const gen = ++generation;
      void opts.language!.loadExtension(lang).then((ext) => {
        if (gen !== generation) return; /* stale — language switched mid-flight */
        if (!view) return;
        view.dispatch({ effects: languageCompartment.reconfigure(ext) });
      });
    });
  }

  onCleanup(() => view?.destroy());
}
