import Module from "module";
import * as path from "path";

export function installVscodeStub(): void {
  const stub = path.join(__dirname, "vscodeStubImpl.js");
  const loader = Module as unknown as {
    _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
  };
  const original = loader._resolveFilename.bind(Module);
  loader._resolveFilename = (request, parent, isMain, options) => {
    if (request === "vscode") return stub;
    return original(request, parent, isMain, options);
  };
}
