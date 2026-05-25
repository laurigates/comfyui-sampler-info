// Playwright driver for the README screenshots.
//
// Drives ComfyUI's frontend through the pack's real public surface:
// loads a single-KSampler workflow, then directly invokes
// widget.onPointerDown to open the picker (the pack's intercept),
// screenshots the dialog after typing a filter, then renders an HTML
// representation of the tooltip — the same widget.options.tooltip text
// LiteGraph paints on the canvas, just rendered as DOM so the
// screenshot is reproducible across hosts.
//
// Direct widget invocation is intentional: clicking the canvas at
// computed coords is fragile (Vue layout, ds scale, devicePixelRatio
// all interact), and `widget.onPointerDown(pointer, node, canvas)` is
// the same public surface the pack hooks into — calling it directly
// exercises the exact code path a real click would.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = resolve(HERE, "workflow.json");
const OUT_DIR = process.env.OUT_DIR || "/out";
const BASE_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188/";
const PICKER_QUERY = process.env.PICKER_QUERY || "dpm sde";

async function main() {
    const workflow = JSON.parse(await readFile(WORKFLOW_PATH, "utf8"));

    const browser = await chromium.launch({
        args: ["--font-render-hinting=none"],
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    page.on("console", (msg) => {
        const t = msg.type();
        if (t === "error" || t === "warning") {
            console.log(`[page:${t}] ${msg.text()}`);
        }
    });

    console.log(`Navigating to ${BASE_URL}…`);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    await page.waitForFunction(
        () => window.app && window.app.graph && Array.isArray(window.app.graph._nodes),
        null,
        { timeout: 30_000 },
    );

    console.log("Loading single-KSampler workflow…");
    await page.evaluate((wf) => {
        // clean=true wipes the default workflow so we end with just our node.
        window.app.loadGraphData(wf, true);
    }, workflow);

    await page.waitForFunction(() => window.app.graph._nodes.length === 1, null, {
        timeout: 10_000,
    });

    // Wait until the pack has had a chance to patch the widget.
    await page.waitForFunction(
        () => {
            const node = window.app.graph._nodes[0];
            const w = node?.widgets?.find((x) => x.name === "sampler_name");
            return w && w._samplerInfoPointerPatched === true;
        },
        null,
        { timeout: 15_000 },
    );

    // Force a canvas redraw so widget.last_y and friends are populated.
    await page.evaluate(() => {
        window.app.canvas?.setDirty?.(true, true);
        window.app.canvas?.draw?.(true, true);
    });

    console.log("Opening picker via widget.onPointerDown…");
    await page.evaluate(() => {
        const node = window.app.graph._nodes[0];
        const widget = node.widgets.find((w) => w.name === "sampler_name");
        widget.onPointerDown({}, node, window.app.canvas);
    });

    const dialog = page.locator("#sampler-info-dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    const search = dialog.locator("input.si-search");
    await search.waitFor({ state: "visible", timeout: 5_000 });
    await search.fill(PICKER_QUERY);

    // Relaxed wait: at least one row after filtering, so corpus growth
    // doesn't lock the script to a hard-coded match count.
    await page.waitForFunction(
        () => document.querySelectorAll("#sampler-info-dialog .si-row").length > 0,
        null,
        { timeout: 5_000 },
    );

    console.log(`Capturing ${OUT_DIR}/picker.png…`);
    await dialog.screenshot({ path: `${OUT_DIR}/picker.png` });

    console.log("Closing picker…");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
        () => !document.querySelector("#sampler-info-dialog"),
        null,
        { timeout: 5_000 },
    );

    // For the tooltip screenshot, render the exact widget.options.tooltip
    // text as an HTML overlay styled to match the modern Vue frontend's
    // tooltip (dark rounded panel, light text). Driving LiteGraph's
    // canvas-painted hover tooltip headlessly is fragile; the text here
    // is identical to what the frontend would paint, so this is a
    // faithful representation of what the user sees on hover.
    console.log(`Capturing ${OUT_DIR}/tooltip.png…`);
    await page.evaluate(() => {
        const node = window.app.graph._nodes[0];
        const widget = node.widgets.find((w) => w.name === "sampler_name");
        const tip = widget.options?.tooltip || widget.tooltip || "(no tooltip set)";

        document.querySelectorAll(".si-screenshot-tooltip-stage").forEach((n) => n.remove());

        const stage = document.createElement("div");
        stage.className = "si-screenshot-tooltip-stage";
        stage.style.cssText = [
            "position: fixed",
            "left: 0",
            "top: 0",
            "width: 720px",
            "padding: 32px 36px",
            "background: #1f2129",
            "z-index: 99998",
            "box-sizing: border-box",
            "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif",
        ].join(";");

        const tooltipEl = document.createElement("div");
        tooltipEl.style.cssText = [
            "background: #2a2d3a",
            "color: #e8e8ea",
            "border-radius: 12px",
            "padding: 22px 28px",
            "font-family: system-ui, -apple-system, 'Segoe UI', sans-serif",
            "font-size: 16px",
            "line-height: 1.55",
            "white-space: pre-wrap",
            "box-shadow: 0 4px 16px rgba(0,0,0,0.45)",
            "max-width: 100%",
            "box-sizing: border-box",
        ].join(";");
        tooltipEl.textContent = tip;
        stage.appendChild(tooltipEl);

        document.body.appendChild(stage);
    });

    const stage = page.locator(".si-screenshot-tooltip-stage");
    await stage.waitFor({ state: "visible", timeout: 5_000 });
    await stage.screenshot({ path: `${OUT_DIR}/tooltip.png` });

    await browser.close();
}

main().catch((err) => {
    console.error("capture failed:", err);
    process.exit(1);
});
