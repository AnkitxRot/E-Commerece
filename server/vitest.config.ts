import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one real Postgres database and each resets it
    // (deletes all rows) in `beforeEach`. Running test files in parallel lets
    // one file's reset/writes race another file's in-flight request, causing
    // spurious FK-constraint violations and flaky assertions. Serializing
    // file execution trades a little wall-clock time for determinism.
    fileParallelism: false,
  },
});
