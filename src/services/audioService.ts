import * as vscode from "vscode";
import { KeyManager } from "./keyManager";
import { fetchWithTimeout } from "./http";
import { writeWorkspaceFile } from "./workspaceIo";

/** Per-request input ceiling accepted by both TTS providers. */
export const TTS_CHAR_LIMIT = 4000;

export class AudioService {
  constructor(private readonly keys: KeyManager) {}

  public async speak(
    text: string,
    engine: "elevenlabs" | "openai",
    voice?: string,
    token?: vscode.CancellationToken,
  ): Promise<string> {
    const input = text.trim();
    if (!input) throw new Error("Select or paste text to narrate.");
    if (input.length > TTS_CHAR_LIMIT) {
      throw new Error(
        `Selection is ${input.length} characters; ${engine} accepts ${TTS_CHAR_LIMIT} per request. ` +
          `Narrate a shorter passage.`,
      );
    }
    const bytes =
      engine === "elevenlabs"
        ? await this.elevenLabs(input, voice || "21m00Tcm4TlvDq8ikWAM", token)
        : await this.openaiTts(input, voice || "alloy", token);
    const rel = `assets/audio/narration_${Date.now()}.mp3`;
    await writeWorkspaceFile(rel, bytes);
    return rel;
  }

  private async elevenLabs(
    text: string,
    voiceId: string,
    token?: vscode.CancellationToken,
  ): Promise<Buffer> {
    const key = await this.keys.requireKey("elevenlabs", "ElevenLabs key missing.");
    const response = await fetchWithTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": key, Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      },
      token,
    );
    if (!response.ok) {
      throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async openaiTts(
    text: string,
    voice: string,
    token?: vscode.CancellationToken,
  ): Promise<Buffer> {
    const key = await this.keys.requireKey("openai", "OpenAI key missing.");
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: text }),
      },
      token,
    );
    if (!response.ok) {
      throw new Error(`OpenAI TTS ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
