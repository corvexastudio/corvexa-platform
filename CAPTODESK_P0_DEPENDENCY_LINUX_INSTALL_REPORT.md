# CAPTODESK — P0 DEPENDENCY / LINUX INSTALL REMEDIATION REPORT

### 1. STATUS
**PASS**  
The repository is now reproducibly installable on Linux and Vercel environments. All 531 tests pass, typechecking passes, linting passes, and the production build compiles cleanly without regressions.

---

### 2. Root Cause
1. `@embedded-postgres/windows-x64` was declared directly under `devDependencies` in `package.json`.
2. Because it was in `devDependencies`, `npm` treated it as a mandatory top-level dependency for development and CI installations.
3. `@embedded-postgres/windows-x64` specifies `"os": ["win32"]` and `"cpu": ["x64"]` in its manifest.
4. When `npm install` or `npm ci` ran on a Linux host (e.g., Vercel build runners, GitHub Actions, Linux developer workstations), npm detected an OS mismatch (`linux` vs `win32`) on a mandatory package and halted execution with:
   ```
   npm error code EBADPLATFORM
   npm error notsup Unsupported platform for @embedded-postgres/windows-x64@18.4.0-beta.17: wanted {"os":"win32","cpu":"x64"} (current: {"os":"linux","cpu":"x64"})
   ```
5. Direct declaration was completely unnecessary because `embedded-postgres` already declares `@embedded-postgres/windows-x64` along with `@embedded-postgres/linux-x64`, `@embedded-postgres/linux-arm64`, and Darwin variants under its own `optionalDependencies`.

---

### 3. Exact Dependency Change
- **Removed:** `@embedded-postgres/windows-x64` from `devDependencies` in `package.json`.
- **Retained:** `embedded-postgres` (`^18.4.0-beta.17`), `pg`, and `@types/pg` in `devDependencies`.
- **Regenerated:** `package-lock.json` so that `@embedded-postgres/windows-x64` transitioned from a mandatory root devDependency to an `optionalDependency` (`"optional": true`).

---

### 4. package.json Changes
```diff
--- a/package.json
+++ b/package.json
@@ -38,7 +38,6 @@
   "devDependencies": {
-    "@embedded-postgres/windows-x64": "^18.4.0-beta.17",
     "@tailwindcss/postcss": "^4",
     "@types/node": "^20",
     "@types/pg": "^8.23.1",
```

---

### 5. package-lock Changes
- Removed `@embedded-postgres/windows-x64` from root `devDependencies` definition.
- Marked `node_modules/@embedded-postgres/windows-x64` with `"optional": true`:
```diff
--- a/package-lock.json
+++ b/package-lock.json
@@ -30,7 +30,6 @@
       "devDependencies": {
-        "@embedded-postgres/windows-x64": "^18.4.0-beta.17",
         "@tailwindcss/postcss": "^4",
@@ -903,6 +902,7 @@
       "dev": true,
       "hasInstallScript": true,
       "license": "MIT",
+      "optional": true,
       "os": [
         "win32"
       ],
```

---

### 6. Linux `npm ci` Result
- **Linux x64 simulation:** `npm install --dry-run --os=linux --cpu=x64` and `npm ci --dry-run --os=linux --cpu=x64` **PASS** (exit code 0).
  - Correctly selects `@embedded-postgres/linux-x64 18.4.0-beta.17`.
  - Safely omits `@embedded-postgres/windows-x64` without `EBADPLATFORM`.
- **Linux arm64 simulation:** `npm ci --dry-run --os=linux --cpu=arm64` **PASS** (exit code 0).
  - Correctly selects `@embedded-postgres/linux-arm64 18.4.0-beta.17`.
- **Clean checkout install:** `npm ci` executed on disk **PASS** (exit code 0, 358 packages added, 668 packages audited in 14s, 0 errors).

---

### 7. Test Result
- **Full Test Suite (`npm test`):**
  - Total tests: **531**
  - Passed: **531**
  - Failed: **0**
  - Skipped: **0**
- **Integration Tests (`npm run test:integration`):**
  - Total tests: **24**
  - Passed: **24**
  - Failed: **0**
  - Confirms local development embedded PostgreSQL continues to execute on Windows without interruption.

---

### 8. Typecheck Result
- **Command:** `npm run typecheck` (`tsc --noEmit`)
- **Result:** **PASS** (exit code 0).

---

### 9. Lint Result
- **Command:** `npm run lint` (`eslint .`)
- **Result:** **PASS** (exit code 0: 0 errors, 1361 existing baseline warnings).

---

### 10. Production Build Result
- **Command:** `npm run build` (`next build`)
- **Result:** **PASS** (exit code 0).
- All 59 static and dynamic routes compiled in 8.3s without platform-specific binary invocations.

---

### 11. Vercel Compatibility Assessment
- Vercel runs builds inside Linux x64 containers.
- Because `@embedded-postgres/windows-x64` is now an optional dependency with `"os": ["win32"]`, Vercel's `npm ci` step skips downloading the Windows binary.
- There are no `postinstall`, `preinstall`, or `prepare` scripts in `package.json` that invoke embedded PostgreSQL.
- The Next.js production build (`next build`) does not import `embedded-postgres` (it is imported exclusively in test files).
- Vercel builds will not encounter `EBADPLATFORM` or attempt to execute Windows binaries.

---

### 12. Remaining Platform-Specific Limitations
- If executing integration tests (`test:integration`) on Linux, the environment must provide a glibc-compatible runtime (e.g., Ubuntu/Debian/Amazon Linux) for `@embedded-postgres/linux-x64` to launch the native PostgreSQL daemon. Alpine (musl-based) environments require glibc compatibility layers if running those integration tests.
- This limitation applies only to executing integration test suites locally/in test CI, not to building or deploying the Next.js application on Vercel.

---

### 13. Files Changed
1. `package.json` (removed `@embedded-postgres/windows-x64` devDependency)
2. `package-lock.json` (synchronized lockfile)
3. `CAPTODESK_P0_DEPENDENCY_LINUX_INSTALL_REPORT.md` (audit report)

---

### 14. Unrelated Pre-Existing Issues Discovered (List Only)
- **1361 ESLint warnings:** Unused variables and `any` types across historical service and telephony files.
- **Node typeless package warning:** Module syntax detected in `.ts` scripts when invoked directly via `node --test` without `"type": "module"` in `package.json`.
- **9 High-severity npm audit advisories:** Vulnerabilities in transitive ecosystem dependencies (`braces`, `cross-spawn`, etc.).
