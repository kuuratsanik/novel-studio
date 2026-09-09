import * as vscode from "vscode";
import { KeyManager } from "./services/keyManager";
import { ContinuityDiagnostics } from "./services/diagnostics";
import { TextRouter } from "./services/textProviders";
import { generateFromTool, StudioTool } from "./services/studioHub";
import { appendToCodex } from "./services/codexWriter";
import { automationSettings } from "./services/automation";

export interface StudioHubDeps {
  keys: KeyManager;
  diagnostics: ContinuityDiagnostics;
  text: TextRouter;
}

export class NovelStudioProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "novelStudio.sidebar";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _deps: StudioHubDeps,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      try {
        switch (data.type) {
          case "generate": {
            this._post({ type: "status", busy: true, message: "Generating…" });
            const result = await generateFromTool(
              this._deps.text,
              this._deps.keys,
              data.tool as StudioTool,
              data.fields || {},
              this._deps.diagnostics,
            );
            this._post({
              type: "generated",
              text: result.output,
              route: result.route,
              busy: false,
              message: `Routed to ${result.route}`,
            });
            break;
          }
          case "routeOutput": {
            await this._manualRoute(data.tool as StudioTool, data.fields || {}, data.text || "");
            this._post({ type: "status", busy: false, message: "Routed output." });
            break;
          }
          case "insertProse": {
            await this._insertProse(data.text);
            break;
          }
          case "replaceSelection": {
            await this._replaceSelection(data.text);
            break;
          }
          case "appendToCodex": {
            await appendToCodex(data.filename, data.header, data.content);
            vscode.window.showInformationMessage(`Saved to codex/${data.filename}`);
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this._post({ type: "status", busy: false, message, error: true });
        vscode.window.showErrorMessage(message);
      }
    });
  }

  private _post(payload: Record<string, unknown>) {
    this._view?.webview.postMessage(payload);
  }

  private async _insertProse(text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) throw new Error("Open a Markdown draft to insert prose.");
    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, `\n\n${text}\n\n`);
    });
  }

  private async _replaceSelection(text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) throw new Error("Highlight text to replace first.");
    await editor.edit((editBuilder) => editBuilder.replace(editor.selection, text));
  }

  private async _manualRoute(tool: StudioTool, fields: Record<string, string>, text: string) {
    if (!text.trim()) return;
    if (tool === "charGen") {
      await appendToCodex("characters.md", fields.name || "New Character", text);
    } else if (tool === "worldGen") {
      const filename = fields.kind === "item" ? "items.md" : "world_lore.md";
      await appendToCodex(filename, fields.subject || "New Lore Entry", text);
    } else if (tool === "plotTwist") {
      const header = (fields.premise || "New Twist Set").split(/[.!?]/)[0];
      await appendToCodex("plot_ideas.md", header, text);
    } else if (tool === "rephraseGen") {
      await this._replaceSelection(text);
    } else {
      await this._insertProse(text);
    }
  }

  private _getHtmlForWebview(): string {
    const auto = automationSettings();
    const modeLabel = auto.fullyAutomatic ? "Automatic" : "Manual";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
    label { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-top: 8px; display: block; }
    textarea, input, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; margin-bottom: 6px; border-radius: 2px; }
    button { width: 100%; padding: 8px; margin-top: 6px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px; font-weight: 600; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.6; cursor: wait; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .tool-panel { display: none; }
    .tool-panel.active { display: block; }
    hr { border: 0; height: 1px; background: var(--vscode-panel-border); margin: 12px 0; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); margin-bottom: 8px; }
    #status { font-size: 11px; min-height: 1.2em; margin: 6px 0; color: var(--vscode-descriptionForeground); }
    #status.error { color: var(--vscode-errorForeground); }
    .hint { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
  </style>
</head>
<body>
  <span class="badge">${modeLabel} mode</span>
  <p class="hint">Fill a tool, click Generate. Output is written to your draft or codex automatically.</p>

  <label>Writing Tool</label>
  <select id="toolSelector">
    <option value="storyGen">Story & Scene Generator</option>
    <option value="charGen">Character Generator</option>
    <option value="worldGen">World Building & Items</option>
    <option value="dialogueGen">Dialogue Enhancer</option>
    <option value="rephraseGen">Developmental Editing / Rephrase</option>
    <option value="plotTwist">Plot Twist / Brainstorming</option>
  </select>

  <div id="panel-storyGen" class="tool-panel active">
    <label>Mode</label>
    <select id="sg_mode"><option value="scene">Scene</option><option value="chapter">Chapter</option><option value="beats">Beats</option></select>
    <label>Scene / Chapter Objective</label>
    <textarea id="sg_goal" rows="2" placeholder="Goal, stakes, and narrative obstacle"></textarea>
    <label>Active Characters & Tone</label>
    <input id="sg_chars" placeholder="Names, emotional state, tone" />
    <label>Ending Beat / Reveal</label>
    <input id="sg_ending" placeholder="Revelation or cliffhanger" />
  </div>

  <div id="panel-charGen" class="tool-panel">
    <label>Character Name & Archetype</label>
    <input id="cg_name" placeholder="e.g. Captain Rowan - Cynical Smuggler" />
    <label>Core Motivation & Internal Flaw</label>
    <textarea id="cg_flaw" rows="2"></textarea>
    <label>Distinct Quirks / Speech Patterns</label>
    <input id="cg_voice" />
  </div>

  <div id="panel-worldGen" class="tool-panel">
    <label>Kind</label>
    <select id="wg_kind"><option value="lore">Lore / location</option><option value="item">Item</option></select>
    <label>Subject</label>
    <input id="wg_subject" />
    <label>Physical & Sensory Rules</label>
    <textarea id="wg_rules" rows="2"></textarea>
  </div>

  <div id="panel-dialogueGen" class="tool-panel">
    <label>Mode</label>
    <select id="dg_mode"><option value="enhance">Enhance</option><option value="generate">Generate</option></select>
    <label>Speakers & Relationship</label>
    <input id="dg_speakers" />
    <label>Hidden Subtext</label>
    <textarea id="dg_subtext" rows="2"></textarea>
  </div>

  <div id="panel-rephraseGen" class="tool-panel">
    <label>Mode</label>
    <select id="rg_mode"><option value="devEdit">Developmental editing</option><option value="rephrase">Rephrase</option></select>
    <label>Target Tone</label>
    <input id="rg_tone" />
    <label>What to Cut / Preserve</label>
    <input id="rg_rules" />
  </div>

  <div id="panel-plotTwist" class="tool-panel">
    <label>What the Reader Believes</label>
    <textarea id="pt_premise" rows="2"></textarea>
    <label>What Must Stay True</label>
    <input id="pt_constraint" />
  </div>

  <button id="btnGenerate">Generate & Route Automatically</button>
  <div id="status"></div>

  <hr/>
  <h3>Output</h3>
  <textarea id="rawOutput" rows="6" placeholder="Generated prose appears here…" readonly></textarea>
  <button class="btn-secondary" id="btnRouteAction">Re-route Output Manually</button>

  <script>
    const vscode = acquireVsCodeApi();
    const selector = document.getElementById('toolSelector');
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('rawOutput');
    const btnGenerate = document.getElementById('btnGenerate');
    const btnRoute = document.getElementById('btnRouteAction');

    function fieldsForTool(tool) {
      if (tool === 'storyGen') return { mode: document.getElementById('sg_mode').value, goal: document.getElementById('sg_goal').value, chars: document.getElementById('sg_chars').value, ending: document.getElementById('sg_ending').value };
      if (tool === 'charGen') return { name: document.getElementById('cg_name').value, flaw: document.getElementById('cg_flaw').value, voice: document.getElementById('cg_voice').value };
      if (tool === 'worldGen') return { kind: document.getElementById('wg_kind').value, subject: document.getElementById('wg_subject').value, rules: document.getElementById('wg_rules').value };
      if (tool === 'dialogueGen') return { mode: document.getElementById('dg_mode').value, speakers: document.getElementById('dg_speakers').value, subtext: document.getElementById('dg_subtext').value };
      if (tool === 'rephraseGen') return { mode: document.getElementById('rg_mode').value, tone: document.getElementById('rg_tone').value, rules: document.getElementById('rg_rules').value };
      if (tool === 'plotTwist') return { premise: document.getElementById('pt_premise').value, constraint: document.getElementById('pt_constraint').value };
      return {};
    }

    selector.addEventListener('change', () => {
      document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + selector.value).classList.add('active');
    });

    btnGenerate.addEventListener('click', () => {
      vscode.postMessage({ type: 'generate', tool: selector.value, fields: fieldsForTool(selector.value) });
    });

    btnRoute.addEventListener('click', () => {
      const text = outputEl.value;
      if (!text.trim()) return;
      vscode.postMessage({ type: 'routeOutput', tool: selector.value, fields: fieldsForTool(selector.value), text });
    });

    window.addEventListener('message', (event) => {
      const data = event.data;
      if (data.type === 'status' || data.type === 'generated') {
        statusEl.textContent = data.message || '';
        statusEl.className = data.error ? 'error' : '';
        btnGenerate.disabled = !!data.busy;
        if (data.text) outputEl.value = data.text;
      }
    });
  </script>
</body>
</html>`;
  }
}
