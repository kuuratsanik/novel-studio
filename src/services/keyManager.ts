import * as vscode from "vscode";

export const SECRET_SERVICES = [
  "novelai",
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "deepinfra",
  "together",
  "fireworks",
  "fal",
  "replicate",
  "ideogram",
  "elevenlabs",
] as const;

export type SecretService = (typeof SECRET_SERVICES)[number] | string;

export class KeyManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  private keyName(service: string): string {
    return `novelStudio.${service}`;
  }

  async setKey(service: string, value: string): Promise<void> {
    await this.secrets.store(this.keyName(service), value);
  }

  async getKey(service: string): Promise<string | undefined> {
    return this.secrets.get(this.keyName(service));
  }

  async hasKey(service: string): Promise<boolean> {
    return !!(await this.getKey(service));
  }

  async requireKey(service: string, message: string): Promise<string> {
    const k = await this.getKey(service);
    if (!k) throw new Error(message);
    return k;
  }

  async deleteKey(service: string): Promise<void> {
    await this.secrets.delete(this.keyName(service));
  }
}
