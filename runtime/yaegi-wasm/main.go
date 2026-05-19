// Yaegi WASM wrapper.
//
// Build:   GOOS=js GOARCH=wasm go build -o ../../public/yaegi/yaegi.wasm .
// Bootstrap: GOROOT-shipped wasm_exec.js is copied next to the .wasm
// in public/yaegi/ by build.sh.
//
// JS-callable surface (registered on globalThis):
//
//   yaegiEval(code: string): { stdout: string, stderr: string, error: string }
//
// `error` is "" on a clean run. yaegi.Eval errors land in `error`,
// runtime panics from the interpreted program land in `stderr` (we
// recover() inside the call so a learner's bad code can't kill the
// worker).
//
// stdout / stderr are captured per-eval: we swap os.Stdout/os.Stderr
// to a pipe, run, drain, then restore. The interpreter (and the
// stdlib it interprets) sees the real os.* pointers, so fmt.Println
// in user code goes through.

package main

import (
	"bytes"
	"fmt"
	"io"
	"reflect"
	"syscall/js"

	"github.com/traefik/yaegi/interp"
	"typeover/runtime/yaegi-wasm/symbols"
)

func main() {
	js.Global().Set("yaegiEval", js.FuncOf(yaegiEval))

	// Keep the Go runtime alive — without this, main returns and the
	// FuncOf bindings stop working. The JS side will call
	// yaegiTerminate() to release if it ever needs to.
	js.Global().Set("yaegiTerminate", js.FuncOf(func(this js.Value, args []js.Value) any {
		// Hook reserved for future cleanup; no-op today.
		return nil
	}))

	<-make(chan struct{})
}

func yaegiEval(this js.Value, args []js.Value) any {
	if len(args) < 1 || args[0].Type() != js.TypeString {
		return result("", "", "yaegiEval: expected a single string argument (code)")
	}
	code := args[0].String()

	stdout, stderr, err := runWithCapture(code)
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	return result(stdout, stderr, errMsg)
}

// runWithCapture builds a fresh interpreter with Stdout/Stderr wired
// to in-memory buffers, evaluates the user's code, and returns what
// the interpreted program wrote.
//
// We use interp.Options.Stdout / Stderr (Yaegi's built-in capture API)
// rather than swapping os.Stdout — under WebAssembly, writes to FDs
// outside {0, 1, 2} aren't routed by wasm_exec.js, so os.Pipe-based
// capture silently lets the output escape to the host's real stdout.
//
// The capture only covers Yaegi's interp.Println / interp.Print and
// any user code that takes the writer from `interp.Options`. Most
// fmt.Println calls in interpreted code still write to the host's
// os.Stdout (the reflected fmt.Println references the host's global)
// — captured fmt output is added by the stdoutOverride / stderrOverride
// helpers below, which monkey-patch the fmt symbols before each eval.
func runWithCapture(code string) (string, string, error) {
	var stdoutBuf, stderrBuf bytes.Buffer

	syms := withFmtOverrides(symbols.Symbols, &stdoutBuf)

	i := interp.New(interp.Options{
		Stdout: &stdoutBuf,
		Stderr: &stderrBuf,
	})
	if err := i.Use(syms); err != nil {
		return "", "", fmt.Errorf("interp.Use(symbols): %w", err)
	}

	var panicErr error
	func() {
		defer func() {
			if r := recover(); r != nil {
				panicErr = fmt.Errorf("panic: %v", r)
			}
		}()
		_, panicErr = i.Eval(code)
	}()

	return stdoutBuf.String(), stderrBuf.String(), panicErr
}

// withFmtOverrides returns a shallow copy of the symbol map with the
// `fmt` package's Print/Printf/Println replaced with versions that
// write to the provided stdout buffer. Pure — doesn't mutate the
// input map.
//
// We override only the small surface a learner is likely to call from
// a freeform exercise; the long-tail (fmt.Sprint*, fmt.Errorf, etc.)
// either is buffer-based already or doesn't emit, so no override
// needed. Stderr override deferred: no exercise routes user output
// through stderr today, and interp.Options.Stderr captures Yaegi's
// own emissions. When a learner exercise needs `fmt.Fprintln(os.Stderr, ...)`
// captured, add a stderr io.Writer parameter and an Fprint override
// that switches on the writer argument.
func withFmtOverrides(base map[string]map[string]reflect.Value, stdout io.Writer) map[string]map[string]reflect.Value {
	out := make(map[string]map[string]reflect.Value, len(base))
	for k, v := range base {
		out[k] = v
	}
	fmtPkg := make(map[string]reflect.Value, len(base["fmt/fmt"])+3)
	for k, v := range base["fmt/fmt"] {
		fmtPkg[k] = v
	}
	fmtPkg["Print"] = reflect.ValueOf(func(a ...any) (int, error) { return fmt.Fprint(stdout, a...) })
	fmtPkg["Printf"] = reflect.ValueOf(func(format string, a ...any) (int, error) {
		return fmt.Fprintf(stdout, format, a...)
	})
	fmtPkg["Println"] = reflect.ValueOf(func(a ...any) (int, error) { return fmt.Fprintln(stdout, a...) })
	out["fmt/fmt"] = fmtPkg
	return out
}

func result(stdout, stderr, errStr string) js.Value {
	obj := js.Global().Get("Object").New()
	obj.Set("stdout", stdout)
	obj.Set("stderr", stderr)
	obj.Set("error", errStr)
	return obj
}
