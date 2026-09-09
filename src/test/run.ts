import { installVscodeStub } from "./vscodeStub";

installVscodeStub();

import { runUnitTests } from "./unit";

try {
  process.stdout.write(`${runUnitTests()}\n`);
} catch (err) {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
