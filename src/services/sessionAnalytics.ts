import * as vscode from "vscode";
import { readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";
import { wordCount } from "./proseStats";

const STORE = ".novel-studio/session.json";

export interface SessionLog {
  days: Record<string, { words: number; sessions: number }>;
  lastWordCount: number;
  streak: number;
  updated: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadSessionLog(): Promise<SessionLog> {
  try {
    return JSON.parse(await readWorkspaceFile(STORE)) as SessionLog;
  } catch {
    return { days: {}, lastWordCount: 0, streak: 0, updated: new Date().toISOString() };
  }
}

async function saveSessionLog(log: SessionLog): Promise<void> {
  await writeWorkspaceFile(STORE, JSON.stringify(log, null, 2) + "\n");
}

export async function recordWordCount(totalWords: number): Promise<SessionLog> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  if (!cfg.get<boolean>("sessionAnalytics")) {
    return loadSessionLog();
  }

  const log = await loadSessionLog();
  const today = todayKey();
  const delta = Math.max(0, totalWords - log.lastWordCount);
  const day = log.days[today] || { words: 0, sessions: 0 };
  day.words += delta;
  day.sessions += delta > 0 ? 1 : 0;
  log.days[today] = day;
  log.lastWordCount = totalWords;
  log.updated = new Date().toISOString();

  const dates = Object.keys(log.days).sort();
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (log.days[dates[i]].words > 0) streak++;
    else break;
  }
  log.streak = streak;

  await saveSessionLog(log);
  return log;
}

export async function sessionSummary(totalWords: number): Promise<{ streak: number; todayWords: number; sessions: number }> {
  const log = await recordWordCount(totalWords);
  const today = log.days[todayKey()] || { words: 0, sessions: 0 };
  return { streak: log.streak, todayWords: today.words, sessions: today.sessions };
}
