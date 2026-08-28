import * as vscode from "vscode";
import * as path from "path";
import { KeyManager } from "./services/keyManager";
import { ContinuityDiagnostics } from "./services/diagnostics";

export class NovelStudioProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "novelStudio.sidebar";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _keys?: KeyManager,
    private readonly _diagnostics?: ContinuityDiagnostics,
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
      switch (data.type) {
        case "copyPrompt": {
          await vscode.env.clipboard.writeText(data.text);
          vscode.window.showInformationMessage(
            `${data.toolName} prompt copied to clipboard!`,
          );
          break;
        }
        case "openToolUrl": {
          vscode.env.openExternal(vscode.Uri.parse(data.url));
          break;
        }
        case "insertProse": {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            await editor.edit((editBuilder) => {
              const position = editor.selection.active;
              editBuilder.insert(position, `\n\n${data.text}\n\n`);
            });
            vscode.window.showInformationMessage("Prose inserted into scene.");
          } else {
            vscode.window.showWarningMessage(
              "Open a Markdown file to insert prose.",
            );
          }
          break;
        }
        case "replaceSelection": {
          const editor = vscode.window.activeTextEditor;
          if (editor && !editor.selection.isEmpty) {
            await editor.edit((editBuilder) => {
              editBuilder.replace(editor.selection, data.text);
            });
            vscode.window.showInformationMessage(
              "Selected text replaced with edited version.",
            );
          } else {
            vscode.window.showWarningMessage(
              "Highlight the text you want to replace first.",
            );
          }
          break;
        }
        case "appendToCodex": {
          await this._appendToCodexFile(
            data.filename,
            data.header,
            data.content,
          );
          break;
        }
      }
    });
  }

  private async _appendToCodexFile(
    filename: string,
    header: string,
    content: string,
  ) {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      vscode.window.showErrorMessage("Please open a workspace folder first.");
      return;
    }

    const codexDir = path.join(folders[0].uri.fsPath, "codex");
    const codexPath = path.join(codexDir, filename);
    const dirUri = vscode.Uri.file(codexDir);
    const codexUri = vscode.Uri.file(codexPath);

    try {
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // already exists
      }

      let existingContent = "";
      try {
        const fileData = await vscode.workspace.fs.readFile(codexUri);
        existingContent = Buffer.from(fileData).toString("utf8");
      } catch {
        // File does not exist yet; create it
      }

      const entry = `\n\n## ${header} (Added: ${new Date().toLocaleDateString()})\n\n${content}\n`;
      const updatedData = Buffer.from(existingContent + entry, "utf8");

      await vscode.workspace.fs.writeFile(codexUri, updatedData);
      vscode.window.showInformationMessage(`Saved to codex/${filename}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to save to codex: ${message}`);
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
        label { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-top: 8px; display: block; }
        textarea, input, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; margin-bottom: 6px; border-radius: 2px; }
        button { width: 100%; padding: 7px; margin-top: 5px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px; font-weight: 600; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); margin-top: 4px; }
        .tool-panel { display: none; }
        .tool-panel.active { display: block; }
        hr { border: 0; height: 1px; background: var(--vscode-panel-border); margin: 12px 0; }
        h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px; }
      </style>
    </head>
    <body>
      <label>Select Toolsaday Module</label>
      <select id="toolSelector">
        <option value="storyGen">Story & Scene Generator</option>
        <option value="charGen">Character Generator</option>
        <option value="worldGen">World Building & Items</option>
        <option value="dialogueGen">Dialogue Enhancer</option>
        <option value="rephraseGen">Developmental Editing / Rephrase</option>
        <option value="plotTwist">Plot Twist / Brainstorming</option>
      </select>

      <button class="btn-secondary" id="btnLaunchWeb">Open Selected Tool on Toolsaday.com</button>

      <hr/>

      <div id="panel-storyGen" class="tool-panel active">
        <label>Mode</label>
        <select id="sg_mode">
          <option value="scene">Scene</option>
          <option value="chapter">Chapter</option>
          <option value="beats">Beats</option>
        </select>
        <label>Scene / Chapter Objective</label>
        <textarea id="sg_goal" rows="2" placeholder="Goal, stakes, and narrative obstacle"></textarea>
        <label>Active Characters & Tone</label>
        <input type="text" id="sg_chars" placeholder="Names, current emotional state, tone" />
        <label>Ending Beat / Reveal</label>
        <input type="text" id="sg_ending" placeholder="Specific revelation or cliffhanger" />
      </div>

      <div id="panel-charGen" class="tool-panel">
        <label>Character Name & Archetype</label>
        <input type="text" id="cg_name" placeholder="e.g. Captain Rowan - Cynical Smuggler" />
        <label>Core Motivation & Internal Flaw</label>
        <textarea id="cg_flaw" rows="2" placeholder="What do they want? What holds them back?"></textarea>
        <label>Distinct Quirks / Speech Patterns</label>
        <input type="text" id="cg_voice" placeholder="e.g. Speaks in short sentences, avoids eye contact" />
      </div>

      <div id="panel-worldGen" class="tool-panel">
        <label>Kind</label>
        <select id="wg_kind">
          <option value="lore">Lore / location</option>
          <option value="item">Item</option>
        </select>
        <label>Lore Subject / Location / Item</label>
        <input type="text" id="wg_subject" placeholder="e.g. The Sunken Vault / Encryption Compass" />
        <label>Physical & Sensory Rules</label>
        <textarea id="wg_rules" rows="2" placeholder="Environment, dangers, limitations, sensory anchors"></textarea>
      </div>

      <div id="panel-dialogueGen" class="tool-panel">
        <label>Mode</label>
        <select id="dg_mode">
          <option value="enhance">Enhance</option>
          <option value="generate">Generate</option>
        </select>
        <label>Speakers & Relationship Dynamic</label>
        <input type="text" id="dg_speakers" placeholder="e.g. Eliza (subordinate) vs Rowan (captain)" />
        <label>Hidden Subtext / Unspoken Agenda</label>
        <textarea id="dg_subtext" rows="2" placeholder="What are they NOT saying directly?"></textarea>
      </div>

      <div id="panel-rephraseGen" class="tool-panel">
        <label>Mode</label>
        <select id="rg_mode">
          <option value="devEdit">Developmental editing</option>
          <option value="rephrase">Rephrase</option>
        </select>
        <label>Target Tone & Voice Adjustment</label>
        <input type="text" id="rg_tone" placeholder="e.g. Darker, faster pacing, more sensory subtext" />
        <label>What to Cut / Preserve</label>
        <input type="text" id="rg_rules" placeholder="e.g. Preserve all plot facts, cut adjectives" />
      </div>

      <div id="panel-plotTwist" class="tool-panel">
        <label>What the Reader Currently Believes</label>
        <textarea id="pt_premise" rows="2" placeholder="The setup, the apparent villain, the plan that seems to work"></textarea>
        <label>What Must Stay True</label>
        <input type="text" id="pt_constraint" placeholder="Facts you refuse to retcon" />
      </div>

      <button id="btnAssemblePrompt">Assemble & Copy Prompt</button>

      <hr/>

      <h3>Ingestion & Routing</h3>
      <label>Generated Output</label>
      <textarea id="rawOutput" rows="5" placeholder="Paste generated text from Toolsaday here..."></textarea>

      <button id="btnRouteAction">Insert into Scene</button>

      <script>
        const vscode = acquireVsCodeApi();

        const toolUrls = {
          storyGen: {
            scene: 'https://toolsaday.com/writing/story-generator',
            chapter: 'https://toolsaday.com/writing/story-chapters',
            beats: 'https://toolsaday.com/writing/story-beats-generator'
          },
          charGen: 'https://toolsaday.com/writing/character-generator',
          worldGen: {
            lore: 'https://toolsaday.com/writing/world-building',
            item: 'https://toolsaday.com/writing/item-generator'
          },
          dialogueGen: {
            enhance: 'https://toolsaday.com/writing/dialogue-enhancer',
            generate: 'https://toolsaday.com/writing/dialogue-generator'
          },
          rephraseGen: {
            devEdit: 'https://toolsaday.com/writing/developmental-editing',
            rephrase: 'https://toolsaday.com/writing/story-rephrase'
          },
          plotTwist: 'https://toolsaday.com/writing/plot-twist-generator'
        };

        const selector = document.getElementById('toolSelector');
        const routeBtn = document.getElementById('btnRouteAction');

        function currentUrl() {
          const tool = selector.value;
          const map = toolUrls[tool];
          if (typeof map === 'string') return map;
          if (tool === 'storyGen') return map[document.getElementById('sg_mode').value];
          if (tool === 'worldGen') return map[document.getElementById('wg_kind').value];
          if (tool === 'dialogueGen') return map[document.getElementById('dg_mode').value];
          if (tool === 'rephraseGen') return map[document.getElementById('rg_mode').value];
          return map;
        }

        function updateRouteLabel() {
          const tool = selector.value;
          if (tool === 'charGen') routeBtn.textContent = 'Save to codex/characters.md';
          else if (tool === 'worldGen') {
            const kind = document.getElementById('wg_kind').value;
            routeBtn.textContent = kind === 'item'
              ? 'Save to codex/items.md'
              : 'Save to codex/world_lore.md';
          } else if (tool === 'rephraseGen') routeBtn.textContent = 'Replace Active Selection in Editor';
          else if (tool === 'plotTwist') routeBtn.textContent = 'Save to codex/plot_ideas.md';
          else routeBtn.textContent = 'Insert into Active Scene (.md)';
        }

        selector.addEventListener('change', () => {
          document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
          document.getElementById('panel-' + selector.value).classList.add('active');
          updateRouteLabel();
        });

        ['sg_mode', 'wg_kind', 'dg_mode', 'rg_mode'].forEach((id) => {
          document.getElementById(id).addEventListener('change', updateRouteLabel);
        });

        document.getElementById('btnLaunchWeb').addEventListener('click', () => {
          vscode.postMessage({ type: 'openToolUrl', url: currentUrl() });
        });

        function block(label, value) {
          const v = (value || '').trim();
          return v ? '[' + label + ']\\n' + v : '';
        }

        document.getElementById('btnAssemblePrompt').addEventListener('click', () => {
          const tool = selector.value;
          let prompt = '';

          if (tool === 'storyGen') {
            prompt = [block('SCENE GOAL & OBSTACLE', document.getElementById('sg_goal').value),
              block('CHARACTERS & TONE', document.getElementById('sg_chars').value),
              block('ENDING BEAT / REVEAL', document.getElementById('sg_ending').value)].filter(Boolean).join('\\n\\n');
          } else if (tool === 'charGen') {
            prompt = [block('CHARACTER ARCHETYPE', document.getElementById('cg_name').value),
              block('MOTIVATION & FLAW', document.getElementById('cg_flaw').value),
              block('VOICE & QUIRKS', document.getElementById('cg_voice').value)].filter(Boolean).join('\\n\\n');
          } else if (tool === 'worldGen') {
            prompt = [block('LORE SUBJECT / ITEM', document.getElementById('wg_subject').value),
              block('RULES & SENSORY ANCHORS', document.getElementById('wg_rules').value)].filter(Boolean).join('\\n\\n');
          } else if (tool === 'dialogueGen') {
            prompt = [block('SPEAKERS & DYNAMIC', document.getElementById('dg_speakers').value),
              block('SUBTEXT & UNCONFRONTED TRUTHS', document.getElementById('dg_subtext').value)].filter(Boolean).join('\\n\\n');
          } else if (tool === 'rephraseGen') {
            prompt = [block('EDITING GOAL & TONE', document.getElementById('rg_tone').value),
              block('CONSTRAINTS', document.getElementById('rg_rules').value)].filter(Boolean).join('\\n\\n');
          } else if (tool === 'plotTwist') {
            prompt = [block('CURRENT BELIEF / SETUP', document.getElementById('pt_premise').value),
              block('MUST REMAIN TRUE', document.getElementById('pt_constraint').value)].filter(Boolean).join('\\n\\n');
          }

          vscode.postMessage({
            type: 'copyPrompt',
            text: prompt,
            toolName: selector.options[selector.selectedIndex].text
          });
        });

        routeBtn.addEventListener('click', () => {
          const text = document.getElementById('rawOutput').value;
          if (!text.trim()) return;

          const tool = selector.value;
          if (tool === 'charGen') {
            const name = document.getElementById('cg_name').value || 'New Character';
            vscode.postMessage({ type: 'appendToCodex', filename: 'characters.md', header: name, content: text });
          } else if (tool === 'worldGen') {
            const subject = document.getElementById('wg_subject').value || 'New Lore Entry';
            const filename = document.getElementById('wg_kind').value === 'item' ? 'items.md' : 'world_lore.md';
            vscode.postMessage({ type: 'appendToCodex', filename, header: subject, content: text });
          } else if (tool === 'plotTwist') {
            const header = (document.getElementById('pt_premise').value || 'New Twist Set').split(/[.!?]/)[0];
            vscode.postMessage({ type: 'appendToCodex', filename: 'plot_ideas.md', header, content: text });
          } else if (tool === 'rephraseGen') {
            vscode.postMessage({ type: 'replaceSelection', text: text });
          } else {
            vscode.postMessage({ type: 'insertProse', text: text });
          }

          document.getElementById('rawOutput').value = '';
        });
      </script>
    </body>
    </html>`;
  }
}
