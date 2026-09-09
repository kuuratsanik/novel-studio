export const window = {
  showQuickPick: async () => undefined,
  showInformationMessage: () => undefined,
  showWarningMessage: () => undefined,
  showErrorMessage: () => undefined,
  showInputBox: async () => undefined,
  createStatusBarItem: () => ({ show() {}, dispose() {}, text: "", tooltip: "", command: "" }),
  get activeTextEditor() {
    return undefined;
  },
};

export const workspace = {
  workspaceFolders: undefined,
  getConfiguration: () => ({ get: () => undefined }),
  fs: {
    readFile: async () => {
      throw new Error("vscode stub: fs.readFile");
    },
    writeFile: async () => undefined,
    createDirectory: async () => undefined,
    readDirectory: async () => [],
  },
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath, scheme: "file" }),
  parse: (value: string) => ({ fsPath: value, scheme: "file" }),
};

export const languages = {
  createDiagnosticCollection: () => ({
    set() {},
    dispose() {},
  }),
};

export const StatusBarAlignment = { Left: 1, Right: 2 };
export const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };

export class Range {
  constructor(
    readonly start: unknown,
    readonly end: unknown,
    _c?: unknown,
    _d?: unknown,
  ) {}
}

export class Diagnostic {
  source?: string;
  constructor(readonly range: Range, readonly message: string, readonly severity?: number) {}
}

export class Position {
  constructor(readonly line: number, readonly character: number) {}
}
