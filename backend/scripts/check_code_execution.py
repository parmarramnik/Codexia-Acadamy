"""
Validate code execution end to end for every advertised language.

Run it where the backend is deployed (or locally with the same env vars):

    cd backend && python scripts/check_code_execution.py            # all languages
    cd backend && python scripts/check_code_execution.py python go  # some languages

For each language it runs six harmless programs through the SAME path the API uses
(services.code_runner.run_program) and prints PASS/FAIL per case:
  basic, stdin, empty input, syntax/compile error, runtime error, timeout.
Exit code 0 only if every case behaved as expected.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import code_runner as cr  # noqa: E402

PROGRAMS = {
    "python": {
        "basic": 'print("hello")',
        "stdin": 'print(int(input()) * 2)',
        "empty": 'import sys\nprint(repr(sys.stdin.read()))',
        "syntax": 'def broken(:\n    pass',
        "runtime": 'print(1 // 0)',
        "timeout": 'while True:\n    pass',
    },
    "javascript": {
        "basic": 'console.log("hello");',
        "stdin": 'const n = parseInt(require("fs").readFileSync(0, "utf8"));\nconsole.log(n * 2);',
        "empty": 'console.log(JSON.stringify(require("fs").readFileSync(0, "utf8")));',
        "syntax": 'function broken( {',
        "runtime": 'null.x;',
        "timeout": 'while (true) {}',
    },
    "cpp": {
        "basic": '#include <iostream>\nint main(){ std::cout << "hello\\n"; }',
        "stdin": '#include <iostream>\nint main(){ int n; std::cin >> n; std::cout << n * 2 << "\\n"; }',
        "empty": '#include <iostream>\nint main(){ int n = -1; std::cin >> n; std::cout << (std::cin.fail() ? "empty" : "value") << "\\n"; }',
        "syntax": 'int main( { return 0 }',
        "runtime": '#include <cstdlib>\nint main(){ std::abort(); }',
        "timeout": 'int main(){ while(true){} }',
    },
    "c": {
        "basic": '#include <stdio.h>\nint main(void){ printf("hello\\n"); return 0; }',
        "stdin": '#include <stdio.h>\nint main(void){ int n; scanf("%d", &n); printf("%d\\n", n * 2); return 0; }',
        "empty": '#include <stdio.h>\nint main(void){ int n; printf("%s\\n", scanf("%d", &n) == 1 ? "value" : "empty"); return 0; }',
        "syntax": 'int main( { return 0 }',
        "runtime": '#include <stdlib.h>\nint main(void){ abort(); }',
        "timeout": 'int main(void){ while(1){} }',
    },
    "java": {
        "basic": 'public class Main { public static void main(String[] a){ System.out.println("hello"); } }',
        "stdin": 'import java.util.*;\npublic class Main { public static void main(String[] a){ Scanner s = new Scanner(System.in); System.out.println(s.nextInt() * 2); } }',
        "empty": 'import java.util.*;\npublic class Main { public static void main(String[] a){ Scanner s = new Scanner(System.in); System.out.println(s.hasNext() ? "value" : "empty"); } }',
        "syntax": 'public class Main { public static void main(String[] a){ int x = ; } }',
        "runtime": 'public class Main { public static void main(String[] a){ int[] x = new int[1]; x[2] = 1; } }',
        "timeout": 'public class Main { public static void main(String[] a){ while(true){} } }',
    },
    "go": {
        "basic": 'package main\nimport "fmt"\nfunc main(){ fmt.Println("hello") }',
        "stdin": 'package main\nimport "fmt"\nfunc main(){ var n int; fmt.Scan(&n); fmt.Println(n * 2) }',
        "empty": 'package main\nimport "fmt"\nfunc main(){ var n int; _, err := fmt.Scan(&n); if err != nil { fmt.Println("empty") } else { fmt.Println("value") } }',
        "syntax": 'package main\nfunc main( {',
        "runtime": 'package main\nfunc main(){ var a []int; _ = a[3] }',
        "timeout": 'package main\nfunc main(){ for {} }',
    },
}

# case -> (stdin, predicate on RunResult, description of the expected behaviour)
CASES = {
    "basic": ("", lambda r: r.ok and r.stdout.strip() == "hello", "prints hello"),
    "stdin": ("21\n", lambda r: r.ok and r.stdout.strip() == "42", "reads 21, prints 42"),
    "empty": ("", lambda r: r.ok and r.stdout.strip() in ('""', "''", "empty"), "handles empty input"),
    "syntax": ("", lambda r: r.status in (cr.COMPILE_ERROR, cr.RUNTIME_ERROR) and bool(r.error_text), "reports a compile/syntax error"),
    "runtime": ("", lambda r: r.status == cr.RUNTIME_ERROR, "reports a runtime error"),
    "timeout": ("", lambda r: r.status == cr.TIMEOUT, "is stopped as a timeout"),
}


def main(argv: list[str]) -> int:
    wanted = [cr.normalize_language(a) for a in argv] or cr.supported_languages()
    try:
        print(f"Provider: {cr.active_provider()}")
    except cr.CodeExecutionUnavailable as exc:
        print(f"Code execution is not usable: {exc}")
        return 2
    print(f"Health: {cr.health()}\n")

    failures = 0
    for lang in wanted:
        print(f"== {lang}")
        for case, (stdin, check, expectation) in CASES.items():
            try:
                result = cr.run_program(PROGRAMS[lang][case], lang, stdin, time_limit_seconds=2, memory_limit_mb=256)
                ok = bool(check(result))
                detail = f"status={result.status} stdout={result.stdout.strip()[:40]!r} time={result.time_ms:.0f}ms"
            except cr.CodeExecutionUnavailable as exc:
                ok, detail = False, f"UNAVAILABLE: {exc}"
            except Exception as exc:  # noqa: BLE001
                ok, detail = False, f"ERROR: {type(exc).__name__}: {exc}"
            failures += 0 if ok else 1
            print(f"  {'PASS' if ok else 'FAIL'}  {case:<8} {expectation:<32} {detail}")
    print(f"\n{'ALL CASES PASSED' if not failures else str(failures) + ' CASE(S) FAILED'}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
