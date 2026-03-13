import { NextRequest } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import { getTradesInRange } from "@/lib/tradesData";
import {
  computeReportMetrics,
  type ReportMetrics,
} from "@/lib/reportMetrics";
import type { Trade } from "@/app/lib/trades";
import { getAlerts, getDailyInsights } from "@/app/lib/ai";
import type { Alert, Insight, Stats, MarketContext } from "@/app/lib/ai";

// ═══ A4 print layout (points: 1/72 inch) ═══
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_TOP = 55;
const MARGIN_SIDE = 56;
const MARGIN_BOTTOM = 50;
const FOOTER_HEIGHT = 22;
/** Reserved zone at bottom of each page so content never overlaps footer */
const FOOTER_ZONE = 58;
const HEADER_HEIGHT = 32;
/** Extra gap between page header and first content (avoids overlap) */
const TITLE_BLOCK_MARGIN_TOP = 28;
/** Content area: top y after header on content pages */
const CONTENT_TOP = PAGE_HEIGHT - MARGIN_TOP - HEADER_HEIGHT - TITLE_BLOCK_MARGIN_TOP;
/** Bottom of content area (above footer) - content must not draw below this */
const MIN_Y = MARGIN_BOTTOM + FOOTER_ZONE;
/** Spacing: main title to subtitle */
const TITLE_TO_SUBTITLE = 16;
/** Spacing: subtitle to divider */
const SUBTITLE_TO_DIVIDER = 18;
/** Spacing: divider to content */
const DIVIDER_TO_CONTENT = 28;
/** Space above each section heading (from previous content) */
const SECTION_HEADING_TOP = 24;
/** Spacing: section heading line to content below */
const SECTION_HEADING_BOTTOM = 18;
/** Cover: space below header block before "PERFORMANCE REPORT" (avoids overlap with subtitle/line) */
const COVER_HEADER_TO_LABEL = 48;
/** Cover: label to top divider */
const COVER_LABEL_BOTTOM = 28;
/** Cover: top divider to main title */
const COVER_DIVIDER_TOP_TO_TITLE = 24;
/** Cover: main title to period */
const COVER_TITLE_TO_PERIOD = 16;
/** Cover: period to generated */
const COVER_PERIOD_TO_GENERATED = 10;
/** Cover: generated to bottom divider */
const COVER_GENERATED_TO_DIVIDER = 28;
/** Cover: bottom divider to meta table */
const COVER_DIVIDER_TO_META = 36;
/** AI insight: margin between blocks */
const INSIGHT_BLOCK_MARGIN_BOTTOM = 20;
/** AI insight: meta line to title */
const INSIGHT_META_TO_TITLE = 12;
/** AI insight: title to body */
const INSIGHT_TITLE_TO_BODY = 10;
/** AI insight: body line height */
const AI_LINE_HEIGHT = 14;
/** AI insight: padding inside block and between blocks */
const AI_BLOCK_PADDING = 14;
/** AI insight: max chars per line for wrap */
const AI_INSIGHTS_MAX_CHARS_PER_LINE = 72;

/** Legacy alias for code that still uses MARGIN */
const MARGIN = MARGIN_SIDE;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/** Replace Unicode chars that WinAnsi cannot encode (e.g. U+2011 non-breaking hyphen). */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/\u2011/g, "-") // non-breaking hyphen
    .replace(/\u2010/g, "-") // hyphen
    .replace(/\u2012/g, "-") // figure dash
    .replace(/\u2013/g, "-") // en dash
    .replace(/\u2014/g, "-") // em dash
    .replace(/\u2212/g, "-"); // minus sign
}

/** Split text into lines that fit within maxCharsPerLine */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxCharsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w.length > maxCharsPerLine ? w.slice(0, maxCharsPerLine) : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ═══ Print palette (grayscale, editorial) ═══
const black = rgb(0, 0, 0);
const white = rgb(1, 1, 1);
const grayDark = rgb(0.2, 0.2, 0.2);
const grayMid = rgb(0.33, 0.33, 0.33);
const grayLabel = rgb(0.4, 0.4, 0.4);
const borderLight = rgb(0.88, 0.88, 0.88);
const zebra = rgb(0.97, 0.97, 0.97);
const darkGray = grayDark;

/** Build AI Stats from report metrics and trades (reuse same shape as dashboard). */
function buildStatsForAi(metrics: ReportMetrics, trades: Trade[]): Stats {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length)
    : 0;
  return {
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor,
    avgWin,
    avgLoss,
    maxDrawdown: 0,
    bestSetup: "N/A",
    netPnl: metrics.netPnl,
  };
}

const defaultMarketContext: MarketContext = {
  gexRegime: "Unknown",
  nextEvent: "None",
  timeToEvent: "—",
  session: "—",
  dayOfWeek: new Date().toLocaleDateString("en-US", { weekday: "long" }),
};

/** Font set for editorial PDF (serif body, mono numbers) */
export type PdfFonts = {
  serif: PDFFont;
  serifBold: PDFFont;
  mono: PDFFont;
};

type PdfContext = {
  pdfDoc: PDFDocument;
  pages: PDFPage[];
  yRef: { y: number };
  fonts: PdfFonts;
  getPage(): PDFPage;
  ensureSpace(requiredHeight: number): boolean;
  /** Start a new page and draw standard content header; returns current y after header. */
  newPageWithHeader(subtitleRight: string): void;
};

function createPdfContext(
  pdfDoc: PDFDocument,
  fonts: PdfFonts
): PdfContext {
  const pages: PDFPage[] = [];
  const yRef = { y: CONTENT_TOP };
  return {
    pdfDoc,
    pages,
    yRef,
    fonts,
    getPage() {
      return pages[pages.length - 1];
    },
    ensureSpace(requiredHeight: number): boolean {
      if (yRef.y - requiredHeight < MIN_Y) {
        pages.push(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
        yRef.y = CONTENT_TOP;
        return true;
      }
      return false;
    },
    newPageWithHeader(subtitleRight: string) {
      pages.push(pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
      const page = pages[pages.length - 1];
      yRef.y = PAGE_HEIGHT - MARGIN_TOP;
      drawPageHeader(page, fonts, subtitleRight);
      yRef.y -= HEADER_HEIGHT + TITLE_BLOCK_MARGIN_TOP;
    },
  };
}

// ═══ Reusable print template helpers ═══

function drawPageHeader(
  page: PDFPage,
  fonts: PdfFonts,
  rightText: string
): void {
  const y = PAGE_HEIGHT - MARGIN_TOP - 6;
  page.drawText("ZORA", {
    x: MARGIN_SIDE,
    y,
    size: 16,
    font: fonts.serifBold,
    color: black,
  });
  page.drawText("Trading Journal & Analytics", {
    x: MARGIN_SIDE,
    y: y - 12,
    size: 8,
    font: fonts.serif,
    color: grayLabel,
  });
  const rightWidth = 180;
  page.drawText(rightText, {
    x: PAGE_WIDTH - MARGIN_SIDE - rightWidth,
    y: y - 6,
    size: 8.5,
    font: fonts.serif,
    color: grayMid,
  });
  page.drawLine({
    start: { x: MARGIN_SIDE, y: y - 20 },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: y - 20 },
    thickness: 2,
    color: black,
  });
}

function drawPageFooter(
  page: PDFPage,
  fonts: PdfFonts,
  centerText: string,
  pageNum: number,
  totalPages: number
): void {
  const y = FOOTER_HEIGHT + 8;
  page.drawLine({
    start: { x: MARGIN_SIDE, y: y + 10 },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: y + 10 },
    thickness: 1,
    color: borderLight,
  });
  page.drawText("ZORA Lite", {
    x: MARGIN_SIDE,
    y,
    size: 7.5,
    font: fonts.serif,
    color: grayLabel,
  });
  page.drawText(centerText, {
    x: PAGE_WIDTH / 2 - 80,
    y,
    size: 7.5,
    font: fonts.serif,
    color: grayLabel,
  });
  page.drawText(`${pageNum} of ${totalPages}`, {
    x: PAGE_WIDTH - MARGIN_SIDE - 36,
    y,
    size: 7.5,
    font: fonts.serif,
    color: grayLabel,
  });
}

function drawSectionHeading(
  page: PDFPage,
  y: number,
  text: string,
  fonts: PdfFonts
): number {
  const lineY = y - 14;
  page.drawText(text.toUpperCase(), {
    x: MARGIN_SIDE,
    y: y - 2,
    size: 9,
    font: fonts.serifBold,
    color: black,
  });
  page.drawLine({
    start: { x: MARGIN_SIDE, y: lineY },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: lineY },
    thickness: 1,
    color: black,
  });
  return lineY - SECTION_HEADING_BOTTOM;
}

type ColDef = { width: number; align: "left" | "right" | "center"; mono?: boolean };
function drawTable(
  page: PDFPage,
  yRef: { y: number },
  fonts: PdfFonts,
  cols: ColDef[],
  rows: string[][],
  options: { footer?: string[]; totalWidth?: number } = {}
): void {
  const totalWidth = options.totalWidth ?? cols.reduce((s, c) => s + c.width, 0);
  const rowHeight = 18;
  const headerHeight = 20;
  const pad = 6;
  const tableTop = yRef.y;
  page.drawRectangle({
    x: MARGIN_SIDE,
    y: tableTop - headerHeight,
    width: totalWidth,
    height: headerHeight,
    color: black,
  });
  let xAcc = MARGIN_SIDE + pad;
  for (let c = 0; c < cols.length; c++) {
    page.drawText(rows[0][c], {
      x: xAcc,
      y: tableTop - 15,
      size: 8.5,
      font: fonts.serifBold,
      color: white,
    });
    xAcc += cols[c].width;
  }
  yRef.y = tableTop - headerHeight;
  for (let r = 1; r < rows.length; r++) {
    yRef.y -= rowHeight;
    const bg = (r - 1) % 2 === 0 ? white : zebra;
    page.drawRectangle({
      x: MARGIN_SIDE,
      y: yRef.y,
      width: totalWidth,
      height: rowHeight,
      color: bg,
    });
    page.drawLine({
      start: { x: MARGIN_SIDE, y: yRef.y + rowHeight },
      end: { x: MARGIN_SIDE + totalWidth, y: yRef.y + rowHeight },
      thickness: 1,
      color: borderLight,
    });
    xAcc = MARGIN_SIDE + pad;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const font = col.mono ? fonts.mono : fonts.serif;
      const text = rows[r][c] ?? "";
      let xPos = xAcc;
      if (col.align === "right") xPos = xAcc + col.width - pad - Math.min(text.length * (col.mono ? 5.2 : 4.5), col.width - pad);
      else if (col.align === "center") xPos = xAcc + (col.width - text.length * 4.5) / 2;
      page.drawText(text.slice(0, 50), {
        x: xPos,
        y: yRef.y + 5,
        size: 9.5,
        font,
        color: grayDark,
      });
      xAcc += col.width;
    }
  }
  if (options.footer && options.footer.length) {
    page.drawLine({
      start: { x: MARGIN_SIDE, y: yRef.y },
      end: { x: MARGIN_SIDE + totalWidth, y: yRef.y },
      thickness: 1.5,
      color: black,
    });
    yRef.y -= rowHeight;
    xAcc = MARGIN_SIDE + pad;
    for (let c = 0; c < options.footer.length; c++) {
      const col = cols[c];
      const text = options.footer[c] ?? "";
      const font = col?.mono ? fonts.mono : fonts.serifBold;
      let xPos = xAcc;
      if (col && col.align === "right") xPos = xAcc + col.width - pad - Math.min(text.length * 5.2, col.width - pad);
      else if (col && col.align === "center") xPos = xAcc + (col.width - text.length * 4.5) / 2;
      page.drawText(text.slice(0, 50), { x: xPos, y: yRef.y + 5, size: 9.5, font, color: black });
      if (col) xAcc += col.width;
    }
  }
  yRef.y -= 18;
}

/** Key-metrics grid (3 columns, label + value per cell) */
function drawKeyMetricsGrid(
  page: PDFPage,
  yRef: { y: number },
  fonts: PdfFonts,
  items: Array<{ label: string; value: string }>
): void {
  const cellW = (PAGE_WIDTH - 2 * MARGIN_SIDE) / 3;
  const cellH = 36;
  const labelYOffset = 22;
  const valueYOffset = 8;
  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = MARGIN_SIDE + col * cellW;
    const y = yRef.y - row * cellH - cellH;
    page.drawRectangle({
      x,
      y,
      width: cellW,
      height: cellH,
      color: white,
    });
    page.drawLine({
      start: { x: x + cellW, y },
      end: { x: x + cellW, y: y + cellH },
      thickness: 1,
      color: borderLight,
    });
    page.drawLine({
      start: { x, y },
      end: { x: x + cellW, y },
      thickness: 1,
      color: borderLight,
    });
    page.drawText(items[i].label.toUpperCase(), {
      x: x + 10,
      y: y + labelYOffset,
      size: 7.5,
      font: fonts.serif,
      color: grayLabel,
    });
    page.drawText(items[i].value, {
      x: x + 10,
      y: y + valueYOffset,
      size: 11,
      font: fonts.mono,
      color: black,
    });
  }
  const rowsUsed = Math.ceil(items.length / 3);
  yRef.y -= rowsUsed * cellH + 18;
}

// ═══ Data helpers for breakdown tables ═══
function getMarketBreakdown(trades: Trade[], totalPnl: number): Array<{ market: string; count: number; wins: number; losses: number; winRate: number; pnl: number; pct: number }> {
  const byMarket = new Map<string, { count: number; wins: number; losses: number; pnl: number }>();
  for (const t of trades) {
    const key = t.market.charAt(0).toUpperCase() + t.market.slice(1);
    const cur = byMarket.get(key) ?? { count: 0, wins: 0, losses: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += t.pnl;
    if (t.pnl > 0) cur.wins += 1; else cur.losses += 1;
    byMarket.set(key, cur);
  }
  return Array.from(byMarket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([market, d]) => ({
      market,
      count: d.count,
      wins: d.wins,
      losses: d.losses,
      winRate: d.count > 0 ? (d.wins / d.count) * 100 : 0,
      pnl: d.pnl,
      pct: totalPnl !== 0 ? (d.pnl / Math.abs(totalPnl)) * 100 : 0,
    }));
}

function getSymbolBreakdown(trades: Trade[]): Array<{ symbol: string; count: number; wins: number; losses: number; winRate: number; pnl: number; avgPnl: number }> {
  const bySymbol = new Map<string, { count: number; wins: number; losses: number; pnl: number }>();
  for (const t of trades) {
    const cur = bySymbol.get(t.symbol) ?? { count: 0, wins: 0, losses: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += t.pnl;
    if (t.pnl > 0) cur.wins += 1; else cur.losses += 1;
    bySymbol.set(t.symbol, cur);
  }
  return Array.from(bySymbol.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([symbol, d]) => ({
      symbol,
      count: d.count,
      wins: d.wins,
      losses: d.losses,
      winRate: d.count > 0 ? (d.wins / d.count) * 100 : 0,
      pnl: d.pnl,
      avgPnl: d.count > 0 ? d.pnl / d.count : 0,
    }));
}

// ═══ Cover page ═══
function drawCoverPage(
  ctx: PdfContext,
  fromParam: string,
  toParam: string,
  generatedAt: Date,
  marketsList: string,
  daysCount: number
): void {
  ctx.pages.push(ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  const page = ctx.getPage();
  const { yRef } = ctx;
  const { fonts } = ctx;
  yRef.y = PAGE_HEIGHT - MARGIN_TOP;

  drawPageHeader(page, fonts, "—  ·  USD  ·  —");

  yRef.y -= COVER_HEADER_TO_LABEL;
  page.drawText("PERFORMANCE REPORT", {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 8.5,
    font: fonts.serif,
    color: grayLabel,
  });
  yRef.y -= COVER_LABEL_BOTTOM;

  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 3,
    color: black,
  });
  yRef.y -= COVER_DIVIDER_TOP_TO_TITLE;

  page.drawText("Trading Performance Report", {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 22,
    font: fonts.serifBold,
    color: black,
  });
  yRef.y -= 22 + COVER_TITLE_TO_PERIOD;
  page.drawText(`${formatDate(new Date(fromParam))} - ${formatDate(new Date(toParam))}`, {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 12,
    font: fonts.serif,
    color: grayMid,
  });
  yRef.y -= COVER_PERIOD_TO_GENERATED;
  page.drawText(`Generated: ${formatDateTime(generatedAt)}`, {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 9,
    font: fonts.serif,
    color: grayLabel,
  });
  yRef.y -= COVER_GENERATED_TO_DIVIDER;

  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 3,
    color: black,
  });
  yRef.y -= COVER_DIVIDER_TO_META;

  const metaRows: [string, string][] = [
    ["Trader", "—"],
    ["Account", "—"],
    ["Base Currency", "USD"],
    ["Reporting Period", `${formatDate(new Date(fromParam))} - ${formatDate(new Date(toParam))} (${daysCount} days)`],
    ["Markets Covered", marketsList || "—"],
    ["Report Scope", "Performance summary, trade log, AI analysis"],
    ["Platform", "ZORA Lite"],
  ];
  const metaRowH = 20;
  const metaTableWidth = PAGE_WIDTH - 2 * MARGIN_SIDE;
  for (let r = 0; r < metaRows.length; r++) {
    const [label, value] = metaRows[r];
    const rowY = yRef.y - metaRowH;
    const bg = r % 2 === 0 ? white : zebra;
    page.drawRectangle({
      x: MARGIN_SIDE,
      y: rowY,
      width: metaTableWidth,
      height: metaRowH,
      color: bg,
    });
    page.drawText(label, {
      x: MARGIN_SIDE + 8,
      y: rowY + 6,
      size: 10,
      font: fonts.serif,
      color: grayMid,
    });
    page.drawText(value, {
      x: MARGIN_SIDE + 180,
      y: rowY + 6,
      size: 10,
      font: fonts.serifBold,
      color: black,
    });
    yRef.y -= metaRowH;
  }
  yRef.y -= 28;

  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 1,
    color: borderLight,
  });
  yRef.y -= 12;

  const disclaimer =
    "This document contains proprietary trading data and is intended for personal review only. " +
    "AI-generated insights are based on statistical pattern analysis and do not constitute financial advice. Contents are confidential.";
  const discLines = wrapText(disclaimer, 85);
  for (const line of discLines) {
    page.drawText(line, {
      x: MARGIN_SIDE,
      y: yRef.y,
      size: 8.5,
      font: fonts.serif,
      color: grayLabel,
    });
    yRef.y -= 12;
  }
  yRef.y = MIN_Y - 20;
}

// ═══ Performance Summary page ═══
function drawPerformanceSummaryPage(
  ctx: PdfContext,
  metrics: ReportMetrics,
  trades: Trade[],
  fromParam: string,
  toParam: string
): void {
  const periodStr = `${formatDate(new Date(fromParam))} - ${formatDate(new Date(toParam))}`;
  ctx.newPageWithHeader(periodStr);
  const page = ctx.getPage();
  const { yRef } = ctx;
  const { fonts } = ctx;

  page.drawText("Performance Summary", {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 13,
    font: fonts.serifBold,
    color: black,
  });
  yRef.y -= TITLE_TO_SUBTITLE;
  page.drawText(periodStr, {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 9,
    font: fonts.serif,
    color: grayMid,
  });
  yRef.y -= SUBTITLE_TO_DIVIDER;
  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 1,
    color: black,
  });
  yRef.y -= DIVIDER_TO_CONTENT;

  yRef.y -= SECTION_HEADING_TOP;
  yRef.y = drawSectionHeading(page, yRef.y, "Key Metrics", fonts);
  const avgWin = metrics.wins > 0 ? metrics.grossProfit / metrics.wins : 0;
  const avgLoss = metrics.losses > 0 ? metrics.grossLoss / metrics.losses : 0;
  drawKeyMetricsGrid(page, yRef, fonts, [
    { label: "Net P&L", value: formatMoney(metrics.netPnl) },
    { label: "Win Rate", value: `${metrics.winRate.toFixed(1)}%` },
    { label: "Total Trades", value: String(metrics.totalTrades) },
    { label: "Profit Factor", value: metrics.profitFactor.toFixed(2) },
    { label: "Expectancy", value: formatMoney(metrics.expectancy) },
    { label: "Max Single Loss", value: formatMoney(metrics.worstTrade) },
  ]);

  yRef.y -= SECTION_HEADING_TOP;
  yRef.y = drawSectionHeading(page, yRef.y, "Detailed Statistics", fonts);
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const detailCols: ColDef[] = [
    { width: 160, align: "left" },
    { width: 90, align: "right", mono: true },
    { width: 220, align: "left" },
  ];
  const detailRows: string[][] = [
    ["Metric", "Value", "Notes"],
    ["Total Trades", String(metrics.totalTrades), ""],
    ["Winning Trades", String(metrics.wins), `${metrics.winRate.toFixed(1)}% of all trades`],
    ["Losing Trades", String(metrics.losses), ""],
    ["Gross Profit", formatMoney(metrics.grossProfit), ""],
    ["Gross Loss", formatMoney(-metrics.grossLoss), ""],
    ["Net P&L", formatMoney(metrics.netPnl), ""],
    ["Profit Factor", metrics.profitFactor.toFixed(2), "Gross profit / gross loss"],
    ["Expectancy per Trade", formatMoney(metrics.expectancy), "Net P&L / total trades"],
    ["Average Win", formatMoney(avgWin), ""],
    ["Average Loss", formatMoney(-avgLoss), ""],
    ["Best Single Trade", formatMoney(metrics.bestTrade), ""],
    ["Worst Single Trade", formatMoney(metrics.worstTrade), ""],
    ["Win / Loss Ratio", winLossRatio.toFixed(2), "Avg win / avg loss"],
  ];
  drawTable(page, yRef, fonts, detailCols, detailRows);

  const marketBreakdown = getMarketBreakdown(trades, metrics.netPnl);
  const totalWidth = PAGE_WIDTH - 2 * MARGIN_SIDE;
  const marketSectionHeight = SECTION_HEADING_TOP + 22 + 20 + Math.max(1, marketBreakdown.length) * 18 + 18 + 14;
  ctx.ensureSpace(marketSectionHeight);
  yRef.y -= SECTION_HEADING_TOP;
  const mCols: ColDef[] = [
    { width: 90, align: "left" },
    { width: 42, align: "center", mono: true },
    { width: 38, align: "center", mono: true },
    { width: 42, align: "center", mono: true },
    { width: 48, align: "center", mono: true },
    { width: 62, align: "right", mono: true },
    { width: 72, align: "right", mono: true },
  ];
  const mHeader = ["Market", "Trades", "Wins", "Losses", "Win Rate", "Net P&L", "% of Total P&L"];
  const mRows: string[][] = [
    mHeader,
    ...marketBreakdown.map((m) => [
      m.market,
      String(m.count),
      String(m.wins),
      String(m.losses),
      `${m.winRate.toFixed(1)}%`,
      formatMoney(m.pnl),
      `${m.pct.toFixed(1)}%`,
    ]),
  ];
  yRef.y = drawSectionHeading(ctx.getPage(), yRef.y, "Breakdown by Market", fonts);
  drawTable(ctx.getPage(), yRef, fonts, mCols, mRows, {
    totalWidth,
    footer: ["Total", String(metrics.totalTrades), String(metrics.wins), String(metrics.losses), `${metrics.winRate.toFixed(1)}%`, formatMoney(metrics.netPnl), "100.0%"],
  });

  const symbolBreakdown = getSymbolBreakdown(trades);
  const symbolSectionHeight = SECTION_HEADING_TOP + 22 + 20 + Math.max(1, symbolBreakdown.length) * 18 + 18 + 14;
  ctx.ensureSpace(symbolSectionHeight);
  yRef.y -= SECTION_HEADING_TOP;
  const sCols: ColDef[] = [
    { width: 90, align: "left" },
    { width: 42, align: "center", mono: true },
    { width: 38, align: "center", mono: true },
    { width: 42, align: "center", mono: true },
    { width: 48, align: "center", mono: true },
    { width: 62, align: "right", mono: true },
    { width: 80, align: "right", mono: true },
  ];
  const sHeader = ["Symbol", "Trades", "Wins", "Losses", "Win Rate", "Net P&L", "Avg P&L / Trade"];
  const sRows: string[][] = [
    sHeader,
    ...symbolBreakdown.map((s) => [
      s.symbol,
      String(s.count),
      String(s.wins),
      String(s.losses),
      `${s.winRate.toFixed(1)}%`,
      formatMoney(s.pnl),
      formatMoney(s.avgPnl),
    ]),
  ];
  yRef.y = drawSectionHeading(ctx.getPage(), yRef.y, "Breakdown by Symbol", fonts);
  const expAvg = metrics.totalTrades > 0 ? metrics.netPnl / metrics.totalTrades : 0;
  drawTable(ctx.getPage(), yRef, fonts, sCols, sRows, {
    totalWidth,
    footer: ["Total", String(metrics.totalTrades), String(metrics.wins), String(metrics.losses), `${metrics.winRate.toFixed(1)}%`, formatMoney(metrics.netPnl), formatMoney(expAvg)],
  });
}

const TRADE_LOG_ROW_HEIGHT = 18;
const TRADE_LOG_HEADER_HEIGHT = 20;
const tradeLogCols: ColDef[] = [
  { width: 72, align: "left" },
  { width: 78, align: "left" },
  { width: 52, align: "center", mono: true },
  { width: 56, align: "left" },
  { width: 58, align: "right", mono: true },
  { width: 58, align: "right", mono: true },
  { width: 44, align: "center" },
];

function drawTradeLogTableHeader(
  page: PDFPage,
  y: number,
  fonts: PdfFonts,
  totalWidth: number
): void {
  page.drawRectangle({
    x: MARGIN_SIDE,
    y: y - TRADE_LOG_HEADER_HEIGHT,
    width: totalWidth,
    height: TRADE_LOG_HEADER_HEIGHT,
    color: black,
  });
  const pad = 6;
  let xAcc = MARGIN_SIDE + pad;
  const headers = ["Date", "Symbol", "Direction", "Market", "P&L", "P&L %", "Result"];
  for (let c = 0; c < tradeLogCols.length; c++) {
    page.drawText(headers[c], {
      x: xAcc,
      y: y - 15,
      size: 8.5,
      font: fonts.serifBold,
      color: white,
    });
    xAcc += tradeLogCols[c].width;
  }
}

function drawTradeLogPages(
  ctx: PdfContext,
  trades: Trade[],
  metrics: ReportMetrics,
  fromParam: string,
  toParam: string
): void {
  const periodStr = `${formatDate(new Date(fromParam))} - ${formatDate(new Date(toParam))}`;
  ctx.newPageWithHeader(periodStr);
  const page = ctx.getPage();
  const { yRef } = ctx;
  const { fonts } = ctx;

  page.drawText("Trade Log", {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 13,
    font: fonts.serifBold,
    color: black,
  });
  yRef.y -= TITLE_TO_SUBTITLE;
  page.drawText(periodStr, {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 9,
    font: fonts.serif,
    color: grayMid,
  });
  yRef.y -= SUBTITLE_TO_DIVIDER;
  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 1,
    color: black,
  });
  yRef.y -= DIVIDER_TO_CONTENT;

  yRef.y -= SECTION_HEADING_TOP;
  yRef.y = drawSectionHeading(page, yRef.y, "Individual Trade Log", fonts);
  const totalWidth = tradeLogCols.reduce((s, c) => s + c.width, 0);
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  drawTradeLogTableHeader(page, yRef.y, fonts, totalWidth);
  yRef.y -= TRADE_LOG_HEADER_HEIGHT;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const newPage = ctx.ensureSpace(TRADE_LOG_ROW_HEIGHT);
    const pg = ctx.getPage();
    if (newPage) {
      drawTradeLogTableHeader(pg, ctx.yRef.y, fonts, totalWidth);
      ctx.yRef.y -= TRADE_LOG_HEADER_HEIGHT;
    }
    ctx.yRef.y -= TRADE_LOG_ROW_HEIGHT;
    const rowY = ctx.yRef.y;
    const bg = i % 2 === 0 ? white : zebra;
    pg.drawRectangle({
      x: MARGIN_SIDE,
      y: rowY,
      width: totalWidth,
      height: TRADE_LOG_ROW_HEIGHT,
      color: bg,
    });
    pg.drawLine({
      start: { x: MARGIN_SIDE, y: rowY + TRADE_LOG_ROW_HEIGHT },
      end: { x: MARGIN_SIDE + totalWidth, y: rowY + TRADE_LOG_ROW_HEIGHT },
      thickness: 1,
      color: borderLight,
    });
    const dateStr = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const marketStr = t.market.charAt(0).toUpperCase() + t.market.slice(1);
    const typeStr = t.type.toUpperCase();
    const resultStr = t.pnl >= 0 ? "Win" : "Loss";
    const pnlStr = formatMoney(t.pnl);
    const pctStr = `${t.pnl >= 0 ? "+" : ""}${t.pnl_percent.toFixed(2)}%`;
    let xAcc = MARGIN_SIDE + 6;
    pg.drawText(dateStr, { x: xAcc, y: rowY + 5, size: 9.5, font: fonts.serif, color: grayDark });
    xAcc += tradeLogCols[0].width;
    pg.drawText(t.symbol, { x: xAcc, y: rowY + 5, size: 9.5, font: fonts.serifBold, color: black });
    xAcc += tradeLogCols[1].width;
    pg.drawText(typeStr, { x: xAcc + (tradeLogCols[2].width - typeStr.length * 5.2) / 2, y: rowY + 5, size: 9.5, font: fonts.mono, color: grayDark });
    xAcc += tradeLogCols[2].width;
    pg.drawText(marketStr, { x: xAcc, y: rowY + 5, size: 9.5, font: fonts.serif, color: grayDark });
    xAcc += tradeLogCols[3].width;
    pg.drawText(pnlStr, { x: xAcc + tradeLogCols[4].width - 6 - pnlStr.length * 5.2, y: rowY + 5, size: 9.5, font: fonts.mono, color: grayDark });
    xAcc += tradeLogCols[4].width;
    pg.drawText(pctStr, { x: xAcc + tradeLogCols[5].width - 6 - pctStr.length * 5.2, y: rowY + 5, size: 9.5, font: fonts.mono, color: grayDark });
    xAcc += tradeLogCols[5].width;
    pg.drawText(resultStr, { x: xAcc + (tradeLogCols[6].width - resultStr.length * 4.5) / 2, y: rowY + 5, size: 9.5, font: fonts.serif, color: grayDark });
  }

  const footerY = ctx.yRef.y;
  const footerPg = ctx.getPage();
  footerPg.drawLine({
    start: { x: MARGIN_SIDE, y: footerY },
    end: { x: MARGIN_SIDE + totalWidth, y: footerY },
    thickness: 1.5,
    color: black,
  });
  ctx.yRef.y -= TRADE_LOG_ROW_HEIGHT;
  const footerRowY = ctx.yRef.y;
  footerPg.drawText(`Total (${metrics.totalTrades} trades)`, {
    x: MARGIN_SIDE + 6,
    y: footerRowY + 5,
    size: 9.5,
    font: fonts.serifBold,
    color: black,
  });
  const pnlX = MARGIN_SIDE + 6 + tradeLogCols[0].width + tradeLogCols[1].width + tradeLogCols[2].width + tradeLogCols[3].width + tradeLogCols[4].width - 6 - formatMoney(metrics.netPnl).length * 5.2;
  footerPg.drawText(formatMoney(metrics.netPnl), {
    x: pnlX,
    y: footerRowY + 5,
    size: 9.5,
    font: fonts.mono,
    color: black,
  });
  const wlText = `${metrics.wins}W / ${metrics.losses}L`;
  const wlX = MARGIN_SIDE + 6 + tradeLogCols[0].width + tradeLogCols[1].width + tradeLogCols[2].width + tradeLogCols[3].width + tradeLogCols[4].width + tradeLogCols[5].width + (tradeLogCols[6].width - wlText.length * 4.5) / 2;
  footerPg.drawText(wlText, {
    x: wlX,
    y: footerRowY + 5,
    size: 9.5,
    font: fonts.serifBold,
    color: black,
  });
  ctx.yRef.y -= 14;
}

function writeAIInsights(
  ctx: PdfContext,
  opts: {
    insights: Insight[];
    alerts: Alert[];
    generatedAt: Date;
    errorMessage?: string;
    emptyMessage?: string;
  }
): void {
  const { insights, alerts, generatedAt, errorMessage, emptyMessage } = opts;
  const { fonts } = ctx;

  ctx.ensureSpace(PAGE_HEIGHT - MARGIN_TOP);

  const page = ctx.getPage();
  const { yRef } = ctx;

  page.drawText("AI Insights", {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 13,
    font: fonts.serifBold,
    color: black,
  });
  yRef.y -= TITLE_TO_SUBTITLE;
  page.drawText(`Generated at: ${formatDateTime(generatedAt)}`, {
    x: MARGIN_SIDE,
    y: yRef.y,
    size: 9,
    font: fonts.serif,
    color: grayMid,
  });
  yRef.y -= SUBTITLE_TO_DIVIDER;
  page.drawLine({
    start: { x: MARGIN_SIDE, y: yRef.y },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: yRef.y },
    thickness: 1,
    color: black,
  });
  yRef.y -= 16;
  page.drawText(
    "AI-generated performance observations based on current journal data.",
    {
      x: MARGIN_SIDE,
      y: yRef.y,
      size: 9,
      font: fonts.serif,
      color: grayLabel,
    }
  );
  yRef.y -= DIVIDER_TO_CONTENT;

  if (errorMessage) {
    ctx.ensureSpace(40);
    const p = ctx.getPage();
    p.drawText(errorMessage, {
      x: MARGIN_SIDE,
      y: ctx.yRef.y,
      size: 10,
      font: fonts.serif,
      color: grayDark,
    });
    ctx.yRef.y -= 20;
    return;
  }

  if (emptyMessage) {
    ctx.ensureSpace(40);
    const p = ctx.getPage();
    p.drawText(emptyMessage, {
      x: MARGIN_SIDE,
      y: ctx.yRef.y,
      size: 10,
      font: fonts.serif,
      color: grayDark,
    });
    ctx.yRef.y -= 20;
    return;
  }

  const hasInsights = insights.length > 0;
  const hasAlerts = alerts.length > 0;

  if (hasInsights) {
    yRef.y -= SECTION_HEADING_TOP;
    yRef.y = drawSectionHeading(page, yRef.y, "Insights", fonts);

    for (const i of insights) {
      const safeMessage = toWinAnsiSafe(i.message);
      const msgLines = wrapText(safeMessage, AI_INSIGHTS_MAX_CHARS_PER_LINE);
      const blockHeight =
        AI_BLOCK_PADDING +
        INSIGHT_META_TO_TITLE +
        12 +
        INSIGHT_TITLE_TO_BODY +
        msgLines.length * AI_LINE_HEIGHT +
        AI_BLOCK_PADDING +
        INSIGHT_BLOCK_MARGIN_BOTTOM;
      ctx.ensureSpace(blockHeight);

      const pg = ctx.getPage();
      const leftBorderX = MARGIN_SIDE;
      const contentX = MARGIN_SIDE + 10;
      const y = ctx.yRef.y;
      pg.drawLine({
        start: { x: leftBorderX, y: y - 4 },
        end: { x: leftBorderX, y: y - blockHeight + 4 },
        thickness: 3,
        color: black,
      });
      pg.drawText(toWinAnsiSafe(i.type), {
        x: contentX,
        y: y - 2,
        size: 7.5,
        font: fonts.serif,
        color: grayLabel,
      });
      pg.drawText(`Confidence: ${i.confidence}%`, {
        x: PAGE_WIDTH - MARGIN_SIDE - 80,
        y: y - 2,
        size: 7.5,
        font: fonts.serif,
        color: grayLabel,
      });
      ctx.yRef.y -= INSIGHT_META_TO_TITLE;
      pg.drawText(toWinAnsiSafe(i.title), { x: contentX, y: ctx.yRef.y, size: 10, font: fonts.serifBold, color: black });
      ctx.yRef.y -= INSIGHT_TITLE_TO_BODY;
      for (const line of msgLines) {
        pg.drawText(line, {
          x: contentX,
          y: ctx.yRef.y,
          size: 9,
          font: fonts.serif,
          color: grayMid,
        });
        ctx.yRef.y -= AI_LINE_HEIGHT;
      }
      ctx.yRef.y -= AI_BLOCK_PADDING + INSIGHT_BLOCK_MARGIN_BOTTOM;
    }
  }

  if (hasAlerts) {
    yRef.y -= SECTION_HEADING_TOP;
    ctx.ensureSpace(SECTION_HEADING_TOP + 22);
    const p = ctx.getPage();
    p.drawText("ALERTS", {
      x: MARGIN_SIDE,
      y: ctx.yRef.y - 2,
      size: 9,
      font: fonts.serifBold,
      color: black,
    });
    ctx.yRef.y -= SECTION_HEADING_BOTTOM;

    for (const a of alerts) {
      const safeMessage = toWinAnsiSafe(a.message);
      const msgLines = wrapText(safeMessage, AI_INSIGHTS_MAX_CHARS_PER_LINE);
      const blockHeight =
        AI_BLOCK_PADDING +
        INSIGHT_META_TO_TITLE +
        12 +
        INSIGHT_TITLE_TO_BODY +
        msgLines.length * AI_LINE_HEIGHT +
        AI_BLOCK_PADDING +
        INSIGHT_BLOCK_MARGIN_BOTTOM;
      ctx.ensureSpace(blockHeight);

      const pg = ctx.getPage();
      const contentX = MARGIN_SIDE + 10;
      const y = ctx.yRef.y;
      pg.drawLine({
        start: { x: MARGIN_SIDE, y: y - 4 },
        end: { x: MARGIN_SIDE, y: y - blockHeight + 4 },
        thickness: 3,
        color: grayMid,
      });
      pg.drawText(`${toWinAnsiSafe(a.type)} - priority ${a.priority}`, {
        x: contentX,
        y: y - 2,
        size: 7.5,
        font: fonts.serif,
        color: grayLabel,
      });
      ctx.yRef.y -= INSIGHT_META_TO_TITLE;
      pg.drawText(toWinAnsiSafe(a.title), { x: contentX, y: ctx.yRef.y, size: 10, font: fonts.serifBold, color: black });
      ctx.yRef.y -= INSIGHT_TITLE_TO_BODY;
      for (const line of msgLines) {
        pg.drawText(line, {
          x: contentX,
          y: ctx.yRef.y,
          size: 9,
          font: fonts.serif,
          color: grayMid,
        });
        ctx.yRef.y -= AI_LINE_HEIGHT;
      }
      ctx.yRef.y -= AI_BLOCK_PADDING + INSIGHT_BLOCK_MARGIN_BOTTOM;
    }
  }

  const disclaimerText =
    "This report was automatically generated by ZORA Lite. AI insights are based on statistical pattern analysis of historical trade data and do not constitute financial advice. Past performance is not indicative of future results.";
  const discLines = wrapText(disclaimerText, 92);
  const discLineHeight = 10;
  const disclaimerHeight = discLines.length * discLineHeight + 22;
  const disclaimerMarginTop = 28;
  ctx.ensureSpace(disclaimerMarginTop + disclaimerHeight);
  ctx.yRef.y -= disclaimerMarginTop;
  const discPg = ctx.getPage();
  discPg.drawLine({
    start: { x: MARGIN_SIDE, y: ctx.yRef.y + 12 },
    end: { x: PAGE_WIDTH - MARGIN_SIDE, y: ctx.yRef.y + 12 },
    thickness: 1,
    color: borderLight,
  });
  ctx.yRef.y -= 10;
  for (const line of discLines) {
    discPg.drawText(line, {
      x: MARGIN_SIDE,
      y: ctx.yRef.y,
      size: 7.5,
      font: fonts.serif,
      color: grayLabel,
    });
    ctx.yRef.y -= discLineHeight;
  }
  ctx.yRef.y -= 8;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return new Response("Missing from or to query params (YYYY-MM-DD)", {
      status: 400,
    });
  }

  const fromISO = `${fromParam}T00:00:00.000Z`;
  const toISO = `${toParam}T23:59:59.999Z`;

  let trades: Trade[];
  try {
    trades = await getTradesInRange(fromISO, toISO);
  } catch (e) {
    console.error("getTradesInRange error", e);
    return new Response("Failed to fetch trades", { status: 500 });
  }

  let metrics: ReturnType<typeof computeReportMetrics>;
  try {
    metrics = computeReportMetrics(trades);
  } catch (e) {
    console.error("computeReportMetrics error", e);
    return new Response("Failed to compute metrics", { status: 500 });
  }

  try {
    const pdfDoc = await PDFDocument.create();
    const serif = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const mono = await pdfDoc.embedFont(StandardFonts.Courier);
    const fonts: PdfFonts = { serif, serifBold, mono };
    const ctx = createPdfContext(pdfDoc, fonts);

    const generatedAt = new Date();
    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);
    const daysCount = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const marketsSet = new Set(trades.map((t) => t.market.charAt(0).toUpperCase() + t.market.slice(1)));
    const marketsList = Array.from(marketsSet).sort().join(", ") || "—";

    drawCoverPage(ctx, fromParam, toParam, generatedAt, marketsList, daysCount);
    drawPerformanceSummaryPage(ctx, metrics, trades, fromParam, toParam);
    drawTradeLogPages(ctx, trades, metrics, fromParam, toParam);

    let insights: Insight[] = [];
    let alerts: Alert[] = [];
    if (trades.length === 0) {
      writeAIInsights(ctx, {
        insights: [],
        alerts: [],
        generatedAt,
        emptyMessage: "Not enough data to generate AI insights.",
      });
    } else {
      try {
        const stats = buildStatsForAi(metrics, trades);
        const context: MarketContext = {
          ...defaultMarketContext,
          dayOfWeek: generatedAt.toLocaleDateString("en-US", { weekday: "long" }),
        };
        const [alertsResult, insightsResult] = await Promise.all([
          getAlerts(trades, stats, context),
          getDailyInsights(trades, stats),
        ]);
        alerts = Array.isArray(alertsResult) ? alertsResult : [];
        insights = Array.isArray(insightsResult) ? insightsResult : [];
        writeAIInsights(ctx, { insights, alerts, generatedAt });
      } catch (e) {
        console.error("AI insights generation during PDF export", e);
        writeAIInsights(ctx, {
          insights: [],
          alerts: [],
          generatedAt,
          errorMessage: "AI insights could not be generated at export time.",
        });
      }
    }

    const totalPages = ctx.pages.length;
    const periodStr = `${formatDate(fromDate)} - ${formatDate(toDate)}`;
    for (let n = 0; n < totalPages; n++) {
      drawPageFooter(
        ctx.pages[n],
        fonts,
        n === 0 ? "Confidential" : periodStr,
        n + 1,
        totalPages
      );
    }

    const pdfBytes = await pdfDoc.save();
    const body = Buffer.from(pdfBytes);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="trading-report_${fromParam}_${toParam}.pdf"`,
        "Content-Length": String(body.length),
      },
    });
  } catch (e) {
    console.error("PDF export error", e);
    return new Response(
      e instanceof Error ? e.message : "PDF generation failed",
      { status: 500 }
    );
  }
}
