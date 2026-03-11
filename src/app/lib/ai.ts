"use server";

import OpenAI from "openai";
import type { Trade } from "./trades";

const systemPrompt = `You are ZORA, an AI trading coach analyzing a trader's journal data.
You are direct, data-driven, and honest — like a professional trading mentor.
You never give financial advice. You analyze patterns and behavior.
Always respond in valid JSON only. No markdown, no explanations outside JSON.`;

/** Stats shape used by AI prompts (derived from trades / report metrics). */
export type Stats = {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  bestSetup: string;
  /** Optional net P&L for the period (e.g. weekly). */
  netPnl?: number;
};

/** Market context for alerts. */
export type MarketContext = {
  gexRegime: string;
  nextEvent: string;
  timeToEvent: string;
  session: string;
  dayOfWeek: string;
};

/** Trader history for grading a single trade. */
export type TraderHistory = {
  setupWR: number;
  symbolWR: number;
  dowWR: number;
};

export type Alert = {
  type: "WARN" | "DANGER" | "OK" | "INFO";
  title: string;
  message: string;
  priority: number;
};

export type Insight = {
  type: "EDGE" | "WARN" | "PATTERN" | "RISK";
  title: string;
  message: string;
  confidence: number;
  category: "TIMING" | "SETUP" | "BEHAVIOR" | "RISK" | "MARKET";
};

export type WeeklyDigest = {
  summary: string;
  verdict: "GREAT" | "GOOD" | "AVERAGE" | "POOR" | "BAD";
  vsLastWeek: "better" | "worse" | "similar";
  highlights: Array<{ type: string; title: string; description: string }>;
  topLesson: string;
  bestTrade: { symbol: string; reason: string };
  worstTrade: { symbol: string; reason: string };
  patterns: string[];
  nextWeekFocus: string[];
  score: {
    execution: number;
    discipline: number;
    riskManagement: number;
    overall: number;
  };
};

export type TradeGrade = {
  grade: "A" | "B" | "C" | "D" | "F";
  score: number;
  execution: string;
  strengths: string[];
  weaknesses: string[];
  verdict: string;
};

function getClient(): OpenAI | null {
  const key = process.env.GROQ_API_KEY;
  // #region agent log
  const hasKey = !!(key && key.trim());
  fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getClient", message: "GROQ client check", data: { hasKey, keyLength: typeof key === "string" ? key.length : 0 }, timestamp: Date.now(), hypothesisId: "A" }) }).catch(() => {});
  // #endregion
  if (!key || key.trim() === "") return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

const NEUTRAL_DIGEST: WeeklyDigest = {
  summary: "Insufficient data for weekly digest.",
  verdict: "AVERAGE",
  vsLastWeek: "similar",
  highlights: [],
  topLesson: "Keep logging trades for better insights.",
  bestTrade: { symbol: "—", reason: "—" },
  worstTrade: { symbol: "—", reason: "—" },
  patterns: [],
  nextWeekFocus: ["Add more trades", "Review journal"],
  score: { execution: 50, discipline: 50, riskManagement: 50, overall: 50 },
};

const NEUTRAL_GRADE: TradeGrade = {
  grade: "C",
  score: 50,
  execution: "Partial",
  strengths: [],
  weaknesses: [],
  verdict: "Insufficient context to grade.",
};

function formatTradeLine(t: Trade): string {
  const setup = t.notes?.slice(0, 30) ?? "N/A";
  return `- ${t.symbol} ${t.type} | Setup: ${setup} | P&L: $${t.pnl.toFixed(2)} | R:R: N/A | Hold: N/A | Emotion: N/A | Date: ${t.created_at}`;
}

function formatTradeShort(t: Trade): string {
  return `- ${t.symbol} ${t.type} P&L: $${t.pnl.toFixed(2)} Emotion: N/A`;
}

export async function getAlerts(
  trades: Trade[],
  stats: Stats,
  context: MarketContext
): Promise<Alert[]> {
  const client = getClient();
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getAlerts", message: "after getClient", data: { clientNull: !client }, timestamp: Date.now(), hypothesisId: "B" }) }).catch(() => {});
  // #endregion
  if (!client) return [];

  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter((t) => t.created_at.startsWith(today));
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const dowTrades = trades.filter(
    (t) => new Date(t.created_at).toLocaleDateString("en-US", { weekday: "long" }) === dayOfWeek
  );
  const dowWins = dowTrades.filter((t) => t.pnl > 0).length;
  const dowWinRate = dowTrades.length > 0 ? (dowWins / dowTrades.length) * 100 : 0;
  const lastFive = trades.slice(0, 5).map((t) => (t.pnl >= 0 ? "W" : "L")).join(", ");
  let streak = 0;
  for (const t of trades) {
    if (t.pnl >= 0) streak++;
    else break;
  }
  const dailyPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);
  const dailyTarget = 0;

  const prompt = `Generate real-time trading alerts.

MARKET CONTEXT:
- GEX regime: ${context.gexRegime}
- Next news event: ${context.nextEvent} in ${context.timeToEvent}
- Active session: ${context.session}
- Day of week: ${context.dayOfWeek}

TODAY'S TRADES:
${todayTrades.length ? todayTrades.map(formatTradeShort).join("\n") : "(none)"}

TRADER HISTORY:
- Win rate on ${context.dayOfWeek}: ${dowWinRate.toFixed(1)}%
- Win rate in ${context.gexRegime} GEX: N/A%
- Last 5 results: ${lastFive || "—"}
- Current streak: ${streak}
- Daily P&L: $${dailyPnl.toFixed(2)} / $${dailyTarget} target

Return JSON array (min 1, max 5):
[
  {
    "type": "WARN" | "DANGER" | "OK" | "INFO",
    "title": "Max 6 words",
    "message": "One specific actionable sentence",
    "priority": 1-5
  }
]

Rules:
- DANGER = 3+ losses in row, near daily limit, high impact news
- WARN = bad historical day, negative GEX
- OK = target reached, good streak
- INFO = neutral useful info
- Only generate alert if there is a real reason
- Sort by priority descending`;

  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getAlerts", message: "no content", data: { noContent: true }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
      // #endregion
      return [];
    }
    const parsed = parseJson<{ alerts?: Alert[] } | Alert[]>(content, {});
    const arr = Array.isArray(parsed) ? parsed : (parsed as { alerts?: Alert[] }).alerts;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getAlerts", message: "after API", data: { contentLen: content.length, resultLength: Array.isArray(arr) ? arr.length : 0 }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
    // #endregion
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getAlerts", message: "catch", data: { caught: true, errName: e instanceof Error ? e.name : "" }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
    // #endregion
    return [];
  }
}

export async function getDailyInsights(trades: Trade[], stats: Stats): Promise<Insight[]> {
  const client = getClient();
  // #region agent log
  fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getDailyInsights", message: "after getClient", data: { clientNull: !client }, timestamp: Date.now(), hypothesisId: "B" }) }).catch(() => {});
  // #endregion
  if (!client) return [];

  const last10 = trades.slice(0, 10);
  const prompt = `Analyze this trader's performance and return insights.

TRADER STATS (all time):
- Total trades: ${stats.totalTrades}
- Win rate: ${stats.winRate.toFixed(1)}%
- Profit factor: ${stats.profitFactor.toFixed(2)}
- Avg win: $${stats.avgWin.toFixed(2)}
- Avg loss: $${stats.avgLoss.toFixed(2)}
- Max drawdown: $${stats.maxDrawdown.toFixed(2)}
- Best setup: ${stats.bestSetup}

RECENT TRADES (last 10):
${last10.length ? last10.map(formatTradeLine).join("\n") : "(none)"}

Return JSON array of 4-6 insights:
[
  {
    "type": "EDGE" | "WARN" | "PATTERN" | "RISK",
    "title": "Short title max 8 words",
    "message": "Detailed explanation max 2 sentences",
    "confidence": 0-100,
    "category": "TIMING" | "SETUP" | "BEHAVIOR" | "RISK" | "MARKET"
  }
]

Rules:
- EDGE = something they do well
- WARN = something to watch out for
- PATTERN = recurring behavior detected
- RISK = active risk needing attention
- Be specific, use actual numbers from the data
- Max 2 of the same type`;

  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getDailyInsights", message: "no content", data: { noContent: true }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
      // #endregion
      return [];
    }
    const parsed = parseJson<{ insights?: Insight[] } | Insight[]>(content, {});
    const arr = Array.isArray(parsed) ? parsed : (parsed as { insights?: Insight[] }).insights;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getDailyInsights", message: "after API", data: { contentLen: content.length, resultLength: Array.isArray(arr) ? arr.length : 0 }, timestamp: Date.now(), hypothesisId: "C" }) }).catch(() => {});
    // #endregion
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/8a16eeec-6b72-41f4-9614-55f64ad0f10d", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "bdb71d" }, body: JSON.stringify({ sessionId: "bdb71d", location: "ai.ts:getDailyInsights", message: "catch", data: { caught: true, errName: e instanceof Error ? e.name : "" }, timestamp: Date.now(), hypothesisId: "D" }) }).catch(() => {});
    // #endregion
    return [];
  }
}

export async function getWeeklyDigest(
  trades: Trade[],
  thisWeek: Stats,
  prevWeek: Stats
): Promise<WeeklyDigest> {
  const client = getClient();
  if (!client) return NEUTRAL_DIGEST;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const dateRange = `${startOfWeek.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`;
  const weekTrades = trades.filter((t) => new Date(t.created_at) >= startOfWeek);
  const bestDay = "—";
  const worstDay = "—";
  const bestDayPnl = 0;
  const worstDayPnl = 0;
  const bestSetup = thisWeek.bestSetup;
  const bestSetupWR = thisWeek.winRate;

  const prompt = `Generate a comprehensive weekly trading digest.

THIS WEEK (${dateRange}):
- Trades: ${thisWeek.totalTrades}
- Win rate: ${thisWeek.winRate.toFixed(1)}%
- Net P&L: $${(thisWeek.netPnl ?? weekTrades.reduce((s, t) => s + t.pnl, 0)).toFixed(2)}
- Profit factor: ${thisWeek.profitFactor.toFixed(2)}
- Best day: ${bestDay} (+$${bestDayPnl.toFixed(2)})
- Worst day: ${worstDay} ($${worstDayPnl.toFixed(2)})
- Best setup: ${bestSetup} (${bestSetupWR.toFixed(0)}% WR)

PREVIOUS WEEK:
- Trades: ${prevWeek.totalTrades}
- Win rate: ${prevWeek.winRate.toFixed(1)}%
- Net P&L: $${(prevWeek.netPnl ?? 0).toFixed(2)}

ALL TRADES THIS WEEK:
${weekTrades.length ? weekTrades.map((t) => `- ${t.created_at} ${t.symbol} ${t.type} | $${t.pnl.toFixed(2)} | SETUP | EMOTION | R:R N/A | Hold N/A\nNotes: ${t.notes ?? ""}`).join("\n") : "(none)"}

Return JSON:
{
  "summary": "2-3 sentence overview",
  "verdict": "GREAT" | "GOOD" | "AVERAGE" | "POOR" | "BAD",
  "vsLastWeek": "better" | "worse" | "similar",
  "highlights": [{"type": "win|loss|lesson", "title": "...", "description": "..."}],
  "topLesson": "Single most important lesson",
  "bestTrade": {"symbol": "...", "reason": "..."},
  "worstTrade": {"symbol": "...", "reason": "..."},
  "patterns": ["pattern1", "pattern2"],
  "nextWeekFocus": ["goal1", "goal2"],
  "score": {
    "execution": 0-100,
    "discipline": 0-100,
    "riskManagement": 0-100,
    "overall": 0-100
  }
}`;

  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return NEUTRAL_DIGEST;
    const parsed = parseJson<WeeklyDigest>(content, NEUTRAL_DIGEST);
    return typeof parsed.summary === "string" ? parsed : NEUTRAL_DIGEST;
  } catch {
    return NEUTRAL_DIGEST;
  }
}

export async function gradeTrade(trade: Trade, history: TraderHistory): Promise<TradeGrade> {
  const client = getClient();
  if (!client) return NEUTRAL_GRADE;

  const prompt = `Grade this trade on execution quality.

TRADE:
- Symbol: ${trade.symbol}
- Direction: ${trade.type}
- Setup: ${trade.notes ?? "N/A"}
- Entry: $${trade.entry_price} Exit: $${trade.exit_price}
- P&L: $${trade.pnl.toFixed(2)}
- R:R achieved: N/A
- Hold time: N/A
- Emotion: N/A
- Notes: "${trade.notes ?? ""}"

CONTEXT:
- This setup historical WR: ${history.setupWR}%
- This symbol historical WR: ${history.symbolWR}%
- Day of week WR: ${history.dowWR}%

Return JSON:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "score": 0-100,
  "execution": "Followed plan" | "Partial" | "Deviated",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "verdict": "One sentence summary"
}`;

  try {
    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return NEUTRAL_GRADE;
    const parsed = parseJson<TradeGrade>(content, NEUTRAL_GRADE);
    return typeof parsed.grade === "string" ? parsed : NEUTRAL_GRADE;
  } catch {
    return NEUTRAL_GRADE;
  }
}
