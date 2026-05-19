// Package symbols is a hand-picked subset of Yaegi's stdlib reflection
// metadata — only the Go stdlib packages Module 1 exercises need.
//
// Each ./{pkg}.go file is a verbatim copy of the corresponding file
// from github.com/traefik/yaegi/stdlib at version v0.16.1, with the
// package declaration rewritten from `stdlib` → `symbols`. Their
// init() functions write into the local `Symbols` map declared here.
//
// Why vendor instead of import: importing `yaegi/stdlib` drags in
// every init() in that package (163 stdlib packages), bloating the
// WASM binary to 40 MB. Selective vendor keeps the binary near the
// shape of what we actually interpret.
//
// Regen: when adding or refreshing a package, copy the matching
// go1_22_<pkg>.go from the yaegi module cache (or run `yaegi extract`)
// and rewrite the package clause. Mark the source version in this file
// so a future bump is visible in `git log`.
//
// Sourced from yaegi v0.16.1 (Go 1.22 generation).

package symbols

import "reflect"

// Symbols holds reflection metadata for every package we register
// with the interpreter via interp.Use. Each ./{pkg}.go's init()
// appends one entry.
var Symbols = map[string]map[string]reflect.Value{}
