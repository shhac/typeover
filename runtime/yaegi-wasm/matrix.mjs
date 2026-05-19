/*
 * The design-docs/04 POC snippet matrix.
 *
 * Each snippet maps to a Go feature category we expect to use in
 * exercises. For each, we run it through the freshly-built WASM
 * blob, capture {stdout, stderr, error, durationMs}, and assert
 * either the expected stdout (for happy-path cases) or expected
 * error pattern (for cases that exercise compile/runtime errors).
 *
 * Output: a Markdown table to stdout that's pasted into
 * design-docs/runtime-matrix.md.
 *
 * Run: pnpm runtime:smoke-matrix
 */
import { bootstrapYaegi } from "./bootstrap.mjs";

const yaegiEval = await bootstrapYaegi();

/* The 20-snippet matrix. Categories from design-docs/04. */
const cases = [
  {
    category: "basic-types",
    name: "var decl + arithmetic",
    code: `package main
import "fmt"
func main() { x := 5; y := 7; fmt.Println(x + y) }`,
    expectStdout: "12\n",
  },
  {
    category: "basic-types",
    name: "const + multi-return",
    code: `package main
import "fmt"
const greeting = "hi"
func split() (string, int) { return greeting, 42 }
func main() { s, n := split(); fmt.Println(s, n) }`,
    expectStdout: "hi 42\n",
  },
  {
    category: "slices",
    name: "append + len",
    code: `package main
import "fmt"
func main() {
	s := []int{1, 2, 3}
	s = append(s, 4)
	fmt.Println(s, len(s))
}`,
    expectStdout: "[1 2 3 4] 4\n",
  },
  {
    category: "slices",
    name: "range with index",
    code: `package main
import "fmt"
func main() {
	for i, v := range []string{"a", "b", "c"} {
		fmt.Printf("%d=%s ", i, v)
	}
	fmt.Println()
}`,
    expectStdout: "0=a 1=b 2=c \n",
  },
  {
    category: "maps",
    name: "make + insert + lookup",
    code: `package main
import "fmt"
func main() {
	m := make(map[string]int)
	m["a"] = 1
	m["b"] = 2
	fmt.Println(m["a"] + m["b"])
}`,
    expectStdout: "3\n",
  },
  {
    category: "maps",
    name: "comma-ok idiom",
    code: `package main
import "fmt"
func main() {
	m := map[string]int{"x": 10}
	if v, ok := m["x"]; ok {
		fmt.Println("got", v)
	}
	if _, ok := m["y"]; !ok {
		fmt.Println("no y")
	}
}`,
    expectStdout: "got 10\nno y\n",
  },
  {
    category: "structs",
    name: "literal + field access",
    code: `package main
import "fmt"
type Point struct{ X, Y int }
func main() {
	p := Point{X: 3, Y: 4}
	fmt.Println(p.X, p.Y)
}`,
    expectStdout: "3 4\n",
  },
  {
    category: "methods",
    name: "value receiver",
    code: `package main
import "fmt"
type T struct{ N int }
func (t T) Double() int { return t.N * 2 }
func main() { fmt.Println(T{N: 7}.Double()) }`,
    expectStdout: "14\n",
  },
  {
    category: "methods",
    name: "pointer receiver mutation",
    code: `package main
import "fmt"
type Counter struct{ N int }
func (c *Counter) Inc() { c.N++ }
func main() {
	c := &Counter{}
	c.Inc()
	c.Inc()
	c.Inc()
	fmt.Println(c.N)
}`,
    expectStdout: "3\n",
  },
  {
    category: "interfaces",
    name: "implicit satisfaction",
    code: `package main
import "fmt"
type Greeter interface{ Greet() string }
type EN struct{}
func (EN) Greet() string { return "hello" }
func main() {
	var g Greeter = EN{}
	fmt.Println(g.Greet())
}`,
    expectStdout: "hello\n",
  },
  {
    category: "interfaces",
    name: "type assertion v, ok",
    code: `package main
import "fmt"
func main() {
	var x any = "abc"
	if s, ok := x.(string); ok {
		fmt.Println("string:", s)
	}
	if _, ok := x.(int); !ok {
		fmt.Println("not int")
	}
}`,
    expectStdout: "string: abc\nnot int\n",
  },
  {
    category: "goroutines+channels",
    name: "send/recv on unbuffered chan",
    code: `package main
import "fmt"
func main() {
	ch := make(chan int)
	go func() { ch <- 42 }()
	fmt.Println(<-ch)
}`,
    expectStdout: "42\n",
  },
  {
    category: "goroutines+channels",
    name: "buffered chan + close + range",
    code: `package main
import "fmt"
func main() {
	ch := make(chan int, 3)
	ch <- 1
	ch <- 2
	ch <- 3
	close(ch)
	for v := range ch {
		fmt.Println(v)
	}
}`,
    expectStdout: "1\n2\n3\n",
  },
  {
    category: "defer",
    name: "LIFO order",
    code: `package main
import "fmt"
func main() {
	defer fmt.Println("a")
	defer fmt.Println("b")
	defer fmt.Println("c")
}`,
    expectStdout: "c\nb\na\n",
  },
  {
    category: "defer",
    name: "args captured at defer-time (the gotcha)",
    code: `package main
import "fmt"
func main() {
	i := 1
	defer fmt.Println("captured:", i)
	i = 99
}`,
    expectStdout: "captured: 1\n",
  },
  {
    category: "generics-stdlib",
    name: "slices.Sort on []int",
    code: `package main
import (
	"fmt"
	"slices"
)
func main() {
	s := []int{3, 1, 4, 1, 5, 9, 2, 6}
	slices.Sort(s)
	fmt.Println(s)
}`,
    expectStdout: "[1 1 2 3 4 5 6 9]\n",
  },
  {
    category: "generics-stdlib",
    name: "slices.Contains",
    code: `package main
import (
	"fmt"
	"slices"
)
func main() {
	fmt.Println(slices.Contains([]string{"a", "b", "c"}, "b"))
}`,
    expectStdout: "true\n",
  },
  {
    category: "generics-custom",
    name: "type parameter with constraint",
    code: `package main
import "fmt"
type Number interface{ ~int | ~float64 }
func Sum[T Number](xs []T) T {
	var s T
	for _, x := range xs {
		s += x
	}
	return s
}
func main() {
	fmt.Println(Sum([]int{1, 2, 3, 4}))
	fmt.Println(Sum([]float64{0.5, 1.5}))
}`,
    expectStdout: "10\n2\n",
  },
  {
    category: "errors",
    name: "errors.New + errors.Is",
    code: `package main
import (
	"errors"
	"fmt"
)
var ErrBoom = errors.New("boom")
func main() {
	err := ErrBoom
	if errors.Is(err, ErrBoom) {
		fmt.Println("matched")
	}
}`,
    expectStdout: "matched\n",
  },
  {
    category: "errors",
    name: "fmt.Errorf with %w wrap",
    code: `package main
import (
	"errors"
	"fmt"
)
var ErrBase = errors.New("base")
func main() {
	wrapped := fmt.Errorf("layer: %w", ErrBase)
	fmt.Println(wrapped)
	fmt.Println(errors.Is(wrapped, ErrBase))
}`,
    expectStdout: "layer: base\ntrue\n",
  },
];

function check(c, r) {
  if (c.expectStdout !== undefined) {
    return r.error === "" && r.stdout === c.expectStdout
      ? { ok: true }
      : {
          ok: false,
          reason: `stdout mismatch (got ${JSON.stringify(r.stdout)}, error=${JSON.stringify(r.error)})`,
        };
  }
  if (c.expectError !== undefined) {
    return r.error.includes(c.expectError)
      ? { ok: true }
      : {
          ok: false,
          reason: `expected error containing "${c.expectError}", got ${JSON.stringify(r.error)}`,
        };
  }
  return { ok: false, reason: "case has no expectation" };
}

const rows = [];
let pass = 0;
let fail = 0;
for (const c of cases) {
  const t0 = performance.now();
  const r = yaegiEval(c.code);
  const dt = (performance.now() - t0).toFixed(1);
  const v = check(c, r);
  if (v.ok) pass++;
  else fail++;
  rows.push({ category: c.category, name: c.name, ok: v.ok, reason: v.reason, dt });
}

/* Markdown report. */
console.log(`# Yaegi WASM POC — runtime matrix\n`);
console.log(
  `**${pass}/${pass + fail} pass** (Yaegi v0.16.1, Go 1.22 generation, minimal stdlib subset).\n`,
);
console.log(`| Category | Snippet | Result | t (ms) |`);
console.log(`|---|---|---|---|`);
for (const row of rows) {
  const mark = row.ok ? "✓" : "✗";
  const note = row.ok ? "" : ` — ${row.reason}`;
  console.log(`| ${row.category} | ${row.name} | ${mark}${note} | ${row.dt} |`);
}

process.exit(fail === 0 ? 0 : 1);
