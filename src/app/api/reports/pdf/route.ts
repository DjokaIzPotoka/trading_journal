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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

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
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

const blueHeader = rgb(0.26, 0.52, 0.96);
const white = rgb(1, 1, 1);
const black = rgb(0, 0, 0);
const darkGray = rgb(0.2, 0.2, 0.2);
const rowBgAlt = rgb(0.96, 0.96, 0.96);

async function writePerformanceSummary(
  page: PDFPage,
  m: ReportMetrics,
  yRef: { y: number },
  font: PDFFont,
  fontBold: PDFFont
): Promise<void> {
  const rowHeight = 22;
  const col1 = MARGIN;
  const col2 = 350;
  const tableWidth = 500;

  page.drawText("Performance Summary", {
    x: col1,
    y: yRef.y,
    size: 14,
    font: fontBold,
    color: black,
  });
  yRef.y -= 24;

  const rows: [string, string][] = [
    ["Total Trades", String(m.totalTrades)],
    ["Net P&L", formatMoney(m.netPnl)],
    ["Win Rate", `${m.winRate.toFixed(1)}%`],
    ["Profit Factor", m.profitFactor.toFixed(2)],
    ["Expectancy", formatMoney(m.expectancy)],
    ["Gross Profit", formatMoney(m.grossProfit)],
    ["Gross Loss", formatMoney(m.grossLoss)],
    ["Best Trade", formatMoney(m.bestTrade)],
    ["Worst Trade", formatMoney(m.worstTrade)],
  ];

  const tableTop = yRef.y;
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: blueHeader,
  });
  page.drawText("Metric", { x: col1 + 8, y: tableTop - 16, size: 10, font: fontBold, color: white });
  page.drawText("Value", { x: col2 + 8, y: tableTop - 16, size: 10, font: fontBold, color: white });
  yRef.y = tableTop - rowHeight;

  for (let i = 0; i < rows.length; i++) {
    yRef.y -= rowHeight;
    const bg = i % 2 === 0 ? white : rowBgAlt;
    page.drawRectangle({
      x: MARGIN,
      y: yRef.y,
      width: tableWidth,
      height: rowHeight,
      color: bg,
    });
    page.drawText(rows[i][0], { x: col1 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
    page.drawText(rows[i][1], { x: col2 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
  }
  yRef.y -= 24;
}

async function writeMarketBreakdown(
  page: PDFPage,
  trades: Trade[],
  yRef: { y: number },
  font: PDFFont,
  fontBold: PDFFont
): Promise<void> {
  const rowHeight = 22;
  const col1 = MARGIN;
  const col2 = 200;
  const col3 = 350;
  const tableWidth = 500;

  page.drawText("Market Breakdown", {
    x: col1,
    y: yRef.y,
    size: 14,
    font: fontBold,
    color: black,
  });
  yRef.y -= 24;

  const byMarket = new Map<string, { count: number; pnl: number }>();
  for (const t of trades) {
    const key = t.market.charAt(0).toUpperCase() + t.market.slice(1);
    const cur = byMarket.get(key) ?? { count: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += t.pnl;
    byMarket.set(key, cur);
  }
  const markets = Array.from(byMarket.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const tableTop = yRef.y;
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: blueHeader,
  });
  page.drawText("Market", { x: col1 + 8, y: tableTop - 16, size: 10, font: fontBold, color: white });
  page.drawText("Trades", { x: col2 + 8, y: tableTop - 16, size: 10, font: fontBold, color: white });
  page.drawText("P&L", { x: col3 + 8, y: tableTop - 16, size: 10, font: fontBold, color: white });
  yRef.y = tableTop - rowHeight;

  if (markets.length === 0) {
    yRef.y -= rowHeight;
    page.drawRectangle({
      x: MARGIN,
      y: yRef.y,
      width: tableWidth,
      height: rowHeight,
      color: rowBgAlt,
    });
    page.drawText("No data", { x: col1 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
  } else {
    for (let i = 0; i < markets.length; i++) {
      yRef.y -= rowHeight;
      const [market, data] = markets[i];
      const bg = i % 2 === 0 ? white : rowBgAlt;
      page.drawRectangle({
        x: MARGIN,
        y: yRef.y,
        width: tableWidth,
        height: rowHeight,
        color: bg,
      });
      page.drawText(market, { x: col1 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
      page.drawText(String(data.count), { x: col2 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
      page.drawText(formatMoney(data.pnl), { x: col3 + 8, y: yRef.y + 7, size: 10, font, color: darkGray });
    }
  }
  yRef.y -= 24;
}

async function writeTradeDetails(
  page: PDFPage,
  trades: Trade[],
  yRef: { y: number },
  font: PDFFont,
  fontBold: PDFFont
): Promise<void> {
  const colW = [70, 80, 50, 60, 70, 70];
  const rowHeight = 20;
  const totalW = colW.reduce((a, b) => a + b, 0);

  page.drawText("Trade Details", {
    x: MARGIN,
    y: yRef.y,
    size: 14,
    font: fontBold,
    color: black,
  });
  yRef.y -= 24;

  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const tableTop = yRef.y;
  page.drawRectangle({
    x: MARGIN,
    y: tableTop - rowHeight,
    width: totalW,
    height: rowHeight,
    color: blueHeader,
  });
  let x = MARGIN + 8;
  page.drawText("Date", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  x += colW[0];
  page.drawText("Symbol", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  x += colW[1];
  page.drawText("Type", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  x += colW[2];
  page.drawText("Market", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  x += colW[3];
  page.drawText("P&L", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  x += colW[4];
  page.drawText("P&L %", { x, y: tableTop - 14, size: 9, font: fontBold, color: white });
  yRef.y = tableTop - rowHeight;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    yRef.y -= rowHeight;
    const bg = i % 2 === 0 ? white : rowBgAlt;
    page.drawRectangle({
      x: MARGIN,
      y: yRef.y,
      width: totalW,
      height: rowHeight,
      color: bg,
    });
    x = MARGIN + 8;
    page.drawText(
      new Date(t.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      { x, y: yRef.y + 5, size: 9, font, color: darkGray }
    );
    x += colW[0];
    page.drawText(t.symbol, { x, y: yRef.y + 5, size: 9, font, color: darkGray });
    x += colW[1];
    page.drawText(t.type, { x, y: yRef.y + 5, size: 9, font, color: darkGray });
    x += colW[2];
    page.drawText(
      t.market.charAt(0).toUpperCase() + t.market.slice(1),
      { x, y: yRef.y + 5, size: 9, font, color: darkGray }
    );
    x += colW[3];
    page.drawText(formatMoney(t.pnl), { x, y: yRef.y + 5, size: 9, font, color: darkGray });
    x += colW[4];
    page.drawText(`${t.pnl_percent.toFixed(2)}%`, { x, y: yRef.y + 5, size: 9, font, color: darkGray });
  }
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
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE_HEIGHT - MARGIN;

    page.drawText("Trading Performance Report", {
      x: MARGIN,
      y,
      size: 18,
      font: fontBold,
      color: black,
    });
    y -= 24;

    page.drawText(
      `${formatDate(new Date(fromParam))} - ${formatDate(new Date(toParam))}`,
      { x: MARGIN, y, size: 12, font, color: rgb(0.33, 0.33, 0.33) }
    );
    y -= 18;

    page.drawText(`Generated: ${formatDateTime(new Date())}`, {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: rgb(0.33, 0.33, 0.33),
    });
    y -= 32;

    const yRef = { y };
    await writePerformanceSummary(page, metrics, yRef, font, fontBold);
    await writeMarketBreakdown(page, trades, yRef, font, fontBold);
    await writeTradeDetails(page, trades, yRef, font, fontBold);

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
