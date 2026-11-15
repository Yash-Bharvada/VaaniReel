#!/usr/bin/env node

/**
 * Wiro model picker for VaaniReel (Node.js 20+, no dependencies).
 *
 * Run from the project root:
 *   node --env-file=.env scripts/wiro-picker.mjs categories
 *   node --env-file=.env scripts/wiro-picker.mjs find image-to-video --top 10
 *   node --env-file=.env scripts/wiro-picker.mjs bakeoff image --top 3
 *   node --env-file=.env scripts/wiro-picker.mjs bakeoff tts ta "வணக்கம்"
 *   node --env-file=.env scripts/wiro-picker.mjs choose image owner/model
 *
 * Bakeoffs are dry runs by default. Add --run to see a spending confirmation.
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const BASE_URL = "https://api.wiro.ai/v1";
const PAGE_SIZE = 100;

const USAGE = `Wiro model picker

Usage:
  node --env-file=.env scripts/wiro-picker.mjs categories
  node --env-file=.env scripts/wiro-picker.mjs find <category> [options]
  node --env-file=.env scripts/wiro-picker.mjs bakeoff <image|video> [options]
  node --env-file=.env scripts/wiro-picker.mjs bakeoff tts <lang> "<text>" [options]
  node --env-file=.env scripts/wiro-picker.mjs choose <task> <owner/model>

Find options:
  --require id1,id2     Require all parameter IDs (checks 25 cheapest models)
  --top 10              Maximum rows to print (default: 10)
  --min-success 0.8     Minimum successful-task ratio (default: 0.8)
  --min-runs 20         Minimum run count (default: 20)
  --search text         Search within the category

Bakeoff options:
  --top 3               Number of qualifying models (default: 3)
  --max-cost 1.5        Hard spending budget in dollars (default: 1.5)
  --run                  Ask for confirmation, then run models sequentially
`;

class WiroError extends Error {
  constructor(message, details = undefined) {
    super(message);
    this.name = "WiroError";
    this.details = details;
  }
}

function fail(message) {
  throw new WiroError(message);
}

function parseNumber(value, optionName, { integer = false, min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
    fail(`${optionName} must be ${integer ? "an integer" : "a number"} >= ${min}.`);
  }
  return number;
}

function parseArguments(args) {
  const positionals = [];
  const options = {};
  const valueOptions = new Set([
    "require",
    "top",
    "min-success",
    "min-runs",
    "search",
    "max-cost",
  ]);
  const flagOptions = new Set(["run"]);

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (flagOptions.has(rawName)) {
      if (inlineValue !== undefined) fail(`--${rawName} does not take a value.`);
      options[rawName] = true;
      continue;
    }
    if (!valueOptions.has(rawName)) fail(`Unknown option: --${rawName}`);

    const value = inlineValue ?? args[index + 1];
    if (value === undefined || (inlineValue === undefined && value.startsWith("--"))) {
      fail(`--${rawName} needs a value.`);
    }
    options[rawName] = value;
    if (inlineValue === undefined) index += 1;
  }

  return { positionals, options };
}

function apiKey() {
  const key = process.env.WIRO_API_KEY?.trim();
  if (!key) {
    fail("WIRO_API_KEY is missing. Add it to .env and run Node with --env-file=.env.");
  }
  return key;
}

async function readJsonResponse(response, label) {
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new WiroError(`${label} returned invalid JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message = data?.message ?? data?.error ?? data?.result ?? response.statusText;
    throw new WiroError(`${label} failed (HTTP ${response.status}): ${String(message)}`, data);
  }
  if (data?.result === false || data?.result === "false") {
    const message = data?.message ?? data?.error ?? "The API returned result:false.";
    throw new WiroError(`${label} failed: ${String(message)}`, data);
  }
  return data;
}

async function wiroPost(path, body, { multipart = false } = {}) {
  const headers = { "x-api-key": apiKey() };
  if (!multipart) headers["content-type"] = "application/json";

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: multipart ? body : JSON.stringify(body),
    });
  } catch (error) {
    throw new WiroError(`Could not reach Wiro for ${path}: ${error.message}`);
  }
  return readJsonResponse(response, path);
}

function categoriesOf(tool) {
  const value = tool?.categories;
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

async function fetchCatalog({ categories = [], search = "" } = {}) {
  const tools = [];
  let start = 0;
  let expectedTotal = Infinity;

  while (start < expectedTotal) {
    const data = await wiroPost("/Tool/List", {
      start,
      limit: PAGE_SIZE,
      search,
      sort: "title",
      order: "asc",
      categories,
      hideworkflows: true,
      summary: true,
    });
    const page = Array.isArray(data.tool) ? data.tool : [];
    tools.push(...page);
    const reportedTotal = Number(data.total);
    expectedTotal = Number.isFinite(reportedTotal) ? reportedTotal : tools.length;
    if (page.length === 0 || page.length < PAGE_SIZE) break;
    start += page.length;
  }

  return tools;
}

function modelParts(tool) {
  const owner = tool.slugowner ?? tool.cleanslugowner;
  const model = tool.slugproject ?? tool.cleanslugproject;
  return { owner: String(owner ?? ""), model: String(model ?? "") };
}

function modelName(tool) {
  const { owner, model } = modelParts(tool);
  return owner && model ? `${owner}/${model}` : "unknown/unknown";
}

function parseDynamicPrice(dynamicprice) {
  if (dynamicprice === null || dynamicprice === undefined || dynamicprice === "") {
    return { price: null, priceMethod: "unknown", tiered: false };
  }

  let parsed = dynamicprice;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { price: null, priceMethod: "unknown", tiered: false };
    }
  }

  let entries;
  if (Array.isArray(parsed)) entries = parsed;
  else if (Array.isArray(parsed?.prices)) entries = parsed.prices;
  else if (parsed && typeof parsed === "object") entries = [parsed];
  else entries = [];

  const priced = entries
    .map((entry) => ({ ...entry, numericPrice: Number(entry?.price) }))
    .filter((entry) => Number.isFinite(entry.numericPrice));
  if (priced.length === 0) {
    return { price: null, priceMethod: "unknown", tiered: entries.length > 1 };
  }

  const emptyInputEntry = priced.find((entry) => {
    const inputs = entry?.inputs;
    return inputs && typeof inputs === "object" && !Array.isArray(inputs) && Object.keys(inputs).length === 0;
  });
  const selected = emptyInputEntry ?? priced.toSorted((a, b) => a.numericPrice - b.numericPrice)[0];
  return {
    price: selected.numericPrice,
    priceMethod: String(selected.priceMethod ?? selected.pricemethod ?? "unknown"),
    tiered: entries.length > 1,
  };
}

function modelStats(tool) {
  const stats = tool?.taskstat ?? {};
  const successes = Number(stats.successcount) || 0;
  const errors = Number(stats.errorcount) || 0;
  const completed = successes + errors;
  const reportedRuns = Number(stats.runcount);
  return {
    successRate: completed > 0 ? successes / completed : 0,
    runCount: Number.isFinite(reportedRuns) ? reportedRuns : completed,
  };
}

function enrichTool(tool) {
  return { ...tool, parsedPrice: parseDynamicPrice(tool.dynamicprice), stats: modelStats(tool) };
}

function compareByPrice(a, b) {
  const left = a.parsedPrice.price ?? Infinity;
  const right = b.parsedPrice.price ?? Infinity;
  return left - right || modelName(a).localeCompare(modelName(b));
}

function formatPrice(priceInfo) {
  if (priceInfo.price === null) return "price unknown";
  return `$${priceInfo.price.toFixed(4)}${priceInfo.tiered ? " (tiered)" : ""}`;
}

function formatComputingTime(value) {
  if (value === null || value === undefined || value === "") return "unknown";
  if (typeof value === "number") return `${value}s`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function printTable(rows, columns) {
  if (rows.length === 0) return;
  const widths = columns.map(({ heading, value }) =>
    Math.min(48, Math.max(heading.length, ...rows.map((row) => String(value(row)).length))),
  );
  const render = (cells) => cells.map((cell, index) => String(cell).slice(0, widths[index]).padEnd(widths[index])).join("  ");
  console.log(render(columns.map((column) => column.heading)));
  console.log(render(widths.map((width) => "-".repeat(width))));
  for (const row of rows) console.log(render(columns.map((column) => column.value(row))));
}

async function getToolDetail(toolOrName) {
  let owner;
  let model;
  if (typeof toolOrName === "string") {
    [owner, model] = toolOrName.split("/");
  } else {
    ({ owner, model } = modelParts(toolOrName));
  }
  if (!owner || !model) fail(`Invalid model name: ${String(toolOrName)}`);

  const data = await wiroPost("/Tool/Detail", { slugowner: owner, slugproject: model });
  const detail = Array.isArray(data.tool) ? data.tool[0] : undefined;
  if (!detail) throw new WiroError(`No detail was returned for ${owner}/${model}.`);
  return detail;
}

function parameterItems(detail) {
  const groups = Array.isArray(detail?.parameters) ? detail.parameters : [];
  return groups.flatMap((group) => Array.isArray(group?.items) ? group.items : []);
}

function parameterId(item) {
  return String(item?.id ?? "").trim();
}

function isRequired(item) {
  return item?.required === true || item?.required === 1 || String(item?.required).toLowerCase() === "true";
}

function optionValue(option) {
  if (option === null || ["string", "number", "boolean"].includes(typeof option)) return option;
  if (typeof option !== "object") return undefined;
  return option.value ?? option.id ?? option.name ?? option.label;
}

function parameterOptions(item) {
  const possibleLists = [
    item?.options,
    item?.values,
    item?.enum,
    item?.choices,
    item?.allowedValues,
    item?.data?.options,
    item?.data?.values,
  ];
  for (const list of possibleLists) {
    if (Array.isArray(list)) return list.map(optionValue).filter((value) => value !== undefined);
  }
  return [];
}

function parameterDefault(item) {
  const candidates = [item?.default, item?.defaultValue, item?.defaultvalue, item?.data?.default];
  return candidates.find((value) => value !== undefined && value !== null && value !== "");
}

function isFileParameter(item) {
  const type = String(item?.type ?? "").toLowerCase();
  return type.includes("file") || type.includes("upload");
}

function findParameter(items, predicate) {
  return items.find((item) => predicate(parameterId(item).toLowerCase(), item));
}

function chooseSmallestDuration(item) {
  const options = parameterOptions(item);
  const numbers = options
    .map((value) => ({ value, number: Number.parseFloat(String(value)) }))
    .filter(({ number }) => Number.isFinite(number))
    .toSorted((a, b) => a.number - b.number);
  return numbers[0]?.value ?? item?.min ?? item?.minimum ?? parameterDefault(item);
}

function resolutionArea(value) {
  const text = String(value).toLowerCase();
  const dimensions = text.match(/(\d+)\s*[x×]\s*(\d+)/);
  if (dimensions) return Number(dimensions[1]) * Number(dimensions[2]);
  const vertical = text.match(/(\d+)p/);
  if (vertical) return Number(vertical[1]) ** 2;
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : Infinity;
}

function chooseLowestResolution(item) {
  const options = parameterOptions(item);
  if (options.length > 0) return options.toSorted((a, b) => resolutionArea(a) - resolutionArea(b))[0];
  return parameterDefault(item);
}

function valueForRequiredParameter(item) {
  const defaultValue = parameterDefault(item);
  if (defaultValue !== undefined) return defaultValue;
  const options = parameterOptions(item);
  if (options.length > 0) return options[0];
  const type = String(item?.type ?? "").toLowerCase();
  if (type.includes("boolean") || type === "bool") return false;
  return undefined;
}

function matchingCategoryNames(allTools, requestedNames) {
  const actual = new Map();
  for (const tool of allTools) {
    for (const category of categoriesOf(tool)) actual.set(category.toLowerCase(), category);
  }
  return requestedNames.map((name) => actual.get(name.toLowerCase())).filter(Boolean);
}

async function commandCategories() {
  const tools = await fetchCatalog();
  const counts = new Map();
  for (const tool of tools) {
    for (const category of new Set(categoriesOf(tool))) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  const rows = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .toSorted((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  if (rows.length === 0) {
    console.log("No categories were returned by Wiro.");
    return;
  }
  printTable(rows, [
    { heading: "CATEGORY", value: (row) => row.category },
    { heading: "MODELS", value: (row) => row.count },
  ]);
}

async function commandFind(positionals, options) {
  const category = positionals[1];
  if (!category) fail("find needs a category.\n\n" + USAGE);
  if (positionals.length > 2) fail(`Unexpected argument: ${positionals[2]}`);

  const top = parseNumber(options.top ?? 10, "--top", { integer: true, min: 1 });
  const minSuccess = parseNumber(options["min-success"] ?? 0.8, "--min-success", { min: 0 });
  if (minSuccess > 1) fail("--min-success must be between 0 and 1.");
  const minRuns = parseNumber(options["min-runs"] ?? 20, "--min-runs", { integer: true, min: 0 });
  const requiredIds = String(options.require ?? "").split(",").map((id) => id.trim()).filter(Boolean);

  const tools = (await fetchCatalog({ categories: [category], search: options.search ?? "" }))
    .map(enrichTool)
    .filter((tool) => tool.stats.successRate >= minSuccess && tool.stats.runCount >= minRuns)
    .toSorted(compareByPrice);

  let qualified = tools;
  if (requiredIds.length > 0) {
    qualified = [];
    for (const tool of tools.slice(0, 25)) {
      try {
        const detail = await getToolDetail(tool);
        const ids = new Set(parameterItems(detail).map(parameterId));
        if (requiredIds.every((id) => ids.has(id))) qualified.push(tool);
      } catch (error) {
        console.error(`Skipping ${modelName(tool)}: ${error.message}`);
      }
    }
  }

  const rows = qualified.slice(0, top);
  if (rows.length === 0) {
    console.log(`No models matched category "${category}" and the requested filters.`);
    console.log("Run the categories command to verify Wiro's current category names.");
    return;
  }

  printTable(rows, [
    { heading: "OWNER/SLUG", value: modelName },
    { heading: "TITLE", value: (tool) => tool.title ?? "" },
    { heading: "PRICE", value: (tool) => formatPrice(tool.parsedPrice) },
    { heading: "PRICE METHOD", value: (tool) => tool.parsedPrice.priceMethod },
    { heading: "SUCCESS", value: (tool) => `${(tool.stats.successRate * 100).toFixed(1)}%` },
    { heading: "RUNS", value: (tool) => tool.stats.runCount },
    { heading: "TYPICAL TIME", value: (tool) => formatComputingTime(tool.computingtime) },
  ]);
}

const TASKS = {
  image: {
    categories: ["image-to-image", "image-editing"],
    prompt: "Premium product photo of this item on a marble table, warm Diwali festival lighting, keep the product exactly the same, no text, no logos",
    sample: "samples/saree.jpg",
  },
  video: {
    categories: ["image-to-video"],
    prompt: "Slow elegant camera push-in, soft warm light, subtle cloth movement",
    sample: "samples/saree.jpg",
  },
  tts: { categories: ["text-to-speech"] },
};

function describeMissingCategories(task, requested, allTools) {
  const available = [...new Set(allTools.flatMap(categoriesOf))].toSorted((a, b) => a.localeCompare(b));
  const related = available.filter((category) => {
    const text = category.toLowerCase();
    return task === "tts" ? text.includes("speech") || text.includes("audio") : text.includes(task) || text.includes("image");
  });
  console.log(`No models matched the expected ${task} category: ${requested.join(" or ")}.`);
  console.log("Wiro category names can change. Run `categories` to inspect the full catalog.");
  if (related.length > 0) console.log(`Possibly related categories: ${related.join(", ")}`);
}

function buildTaskInputs(task, detail, taskArguments) {
  const items = parameterItems(detail);
  const values = new Map();
  const fileIds = new Set();

  const promptItem = findParameter(items, (id) => id === "prompt" || id.includes("prompt"));
  const imageItem = findParameter(items, (id, item) => id.includes("image") && isFileParameter(item));

  if (task === "image" || task === "video") {
    if (!promptItem) return { error: "no prompt parameter" };
    if (!imageItem) return { error: "no image file parameter" };
    values.set(parameterId(promptItem), TASKS[task].prompt);
    values.set(parameterId(imageItem), TASKS[task].sample);
    fileIds.add(parameterId(imageItem));

    const aspectItem = findParameter(items, (id) => id.includes("aspect") && id.includes("ratio"));
    if (aspectItem) {
      const choices = parameterOptions(aspectItem);
      const square = choices.find((choice) => String(choice).replaceAll(" ", "") === "1:1");
      values.set(parameterId(aspectItem), square ?? parameterDefault(aspectItem) ?? "1:1");
    }
  }

  if (task === "video") {
    const durationItem = findParameter(items, (id) => id.includes("duration") || id.includes("seconds"));
    if (durationItem) {
      const duration = chooseSmallestDuration(durationItem);
      if (duration !== undefined) values.set(parameterId(durationItem), duration);
    }
    const resolutionItem = findParameter(items, (id) => id.includes("resolution") || id.includes("quality"));
    if (resolutionItem) {
      const resolution = chooseLowestResolution(resolutionItem);
      if (resolution !== undefined) values.set(parameterId(resolutionItem), resolution);
    }
  }

  if (task === "tts") {
    // Speech models often call their spoken text "prompt". Avoid control fields
    // such as applyTextNormalization, which also happen to contain "text".
    const textItem =
      findParameter(items, (id) => ["text", "inputtext", "input_text", "prompt", "content", "script"].includes(id)) ??
      findParameter(items, (id, item) =>
        !isFileParameter(item) &&
        (id.includes("speechtext") || id.includes("textinput") || id.includes("transcript")),
      );
    const languageItem = findParameter(items, (id) => id === "lang" || id.includes("language") || id.includes("locale"));
    if (!textItem) return { error: "no text parameter" };
    values.set(parameterId(textItem), taskArguments.text);
    if (languageItem) {
      const languages = parameterOptions(languageItem);
      if (languages.length > 0 && !languages.some((value) => String(value).toLowerCase() === taskArguments.lang.toLowerCase())) {
        return { error: `language "${taskArguments.lang}" is not offered by parameter "${parameterId(languageItem)}"` };
      }
      values.set(parameterId(languageItem), taskArguments.lang);
    }
  }

  for (const item of items) {
    const id = parameterId(item);
    if (!id || !isRequired(item) || values.has(id)) continue;
    if (isFileParameter(item)) return { error: `required file parameter "${id}" has no task input` };
    const fallback = valueForRequiredParameter(item);
    if (fallback === undefined) return { error: `required parameter "${id}" has no sensible default or option` };
    values.set(id, fallback);
  }

  return { values, fileIds, parameterIds: [...values.keys()] };
}

async function prepareBakeoff(task, top, taskArguments) {
  const allTools = await fetchCatalog();
  const matchedNames = matchingCategoryNames(allTools, TASKS[task].categories);
  if (matchedNames.length === 0) {
    describeMissingCategories(task, TASKS[task].categories, allTools);
    return [];
  }

  const categorySet = new Set(matchedNames.map((name) => name.toLowerCase()));
  const candidates = allTools
    .filter((tool) => categoriesOf(tool).some((category) => categorySet.has(category.toLowerCase())))
    .map(enrichTool)
    .filter((tool) => tool.stats.successRate >= 0.8 && tool.stats.runCount >= 20)
    .toSorted(compareByPrice);

  const prepared = [];
  for (const tool of candidates) {
    if (prepared.length >= top) break;
    try {
      const detail = await getToolDetail(tool);
      const built = buildTaskInputs(task, detail, taskArguments);
      if (built.error) {
        console.log(`Skipping ${modelName(tool)}: ${built.error}.`);
        continue;
      }
      prepared.push({ tool, detail, ...built });
    } catch (error) {
      console.log(`Skipping ${modelName(tool)}: ${error.message}`);
    }
  }

  if (prepared.length === 0) {
    console.log(`No ${task} models passed the quality and parameter checks.`);
    console.log("Models need at least 20 runs, an 80% success rate, and usable required inputs.");
  }
  return prepared;
}

function printableValue(value, isFile) {
  if (isFile) return `<file: ${value}>`;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function printBakeoffPlan(task, prepared, maxCost) {
  console.log(`\nDRY RUN: ${task} bakeoff (${prepared.length} model${prepared.length === 1 ? "" : "s"})`);
  let knownTotal = 0;
  let hasUnknown = false;
  for (const item of prepared) {
    const price = item.tool.parsedPrice.price;
    if (price === null) hasUnknown = true;
    else knownTotal += price;
    console.log(`\n${modelName(item.tool)} — ${formatPrice(item.tool.parsedPrice)}`);
    for (const [id, value] of item.values) {
      console.log(`  ${id}: ${printableValue(value, item.fileIds.has(id))}`);
    }
  }
  console.log(`\nEstimated total: $${knownTotal.toFixed(4)}${hasUnknown ? " plus unknown-priced models" : ""}`);
  console.log(`Maximum allowed actual cost: $${maxCost.toFixed(2)}`);
  console.log("Nothing was run or billed. Add --run to request confirmation.");
}

async function buildRunBody(values, fileIds) {
  if (fileIds.size === 0) return { body: Object.fromEntries(values), multipart: false };
  const form = new FormData();
  for (const [id, value] of values) {
    if (fileIds.has(id)) {
      const bytes = await readFile(String(value));
      form.append(id, new Blob([bytes]), basename(String(value)));
    } else {
      form.append(id, typeof value === "string" ? value : JSON.stringify(value));
    }
  }
  return { body: form, multipart: true };
}

async function runModel(preparedItem) {
  const { owner, model } = modelParts(preparedItem.tool);
  const request = await buildRunBody(preparedItem.values, preparedItem.fileIds);
  const started = performance.now();
  const response = await wiroPost(
    `/Run/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/sync`,
    request.body,
    { multipart: request.multipart },
  );
  const elapsedSeconds = (performance.now() - started) / 1000;
  const taskResult = Array.isArray(response.tasklist) ? response.tasklist[0] : undefined;
  if (!taskResult) throw new WiroError(`${owner}/${model} returned no task result.`);
  return { response, taskResult, elapsedSeconds };
}

function safeFilename(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "model";
}

function extensionFrom(contentType, url) {
  const known = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
  };
  const cleanType = contentType?.split(";")[0].toLowerCase();
  if (known[cleanType]) return known[cleanType];
  try {
    const extension = extname(new URL(url).pathname);
    if (/^\.[a-z0-9]{1,5}$/i.test(extension)) return extension;
  } catch {
    // The caller will use a generic extension for an unusual URL.
  }
  return ".bin";
}

async function downloadOutput(url, destinationBase) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new WiroError(`Could not download output: ${error.message}`);
  }
  if (!response.ok) throw new WiroError(`Output download failed (HTTP ${response.status}).`);
  const extension = extensionFrom(response.headers.get("content-type"), url);
  const destination = `${destinationBase}${extension}`;
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return basename(destination);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mediaHtml(task, filename) {
  const safe = escapeHtml(filename);
  const extension = extname(filename).toLowerCase();
  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
  const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
  const audioExtensions = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac"]);
  if (task === "image" && imageExtensions.has(extension)) {
    return `<img src="${safe}" alt="Generated result" loading="lazy">`;
  }
  if (task === "video" && videoExtensions.has(extension)) {
    return `<video src="${safe}" controls preload="metadata"></video>`;
  }
  if (task === "tts" && audioExtensions.has(extension)) {
    return `<audio src="${safe}" controls preload="metadata"></audio>`;
  }
  return `<p><a href="${safe}" download>Download ${safe}</a></p>`;
}

async function writeIndex(task, directory, results) {
  const cards = results.map((result) => {
    const media = result.files.length > 0
      ? result.files.map((file) => mediaHtml(task, file)).join("\n")
      : "<p>No output file returned.</p>";
    return `<article>
      <h2>${escapeHtml(result.model)}</h2>
      ${media}
      <dl>
        <div><dt>Actual cost</dt><dd>$${escapeHtml(result.cost.toFixed(4))}</dd></div>
        <div><dt>Time taken</dt><dd>${escapeHtml(result.elapsed.toFixed(2))} seconds</dd></div>
        <div><dt>pexit</dt><dd>${escapeHtml(result.pexit)}</dd></div>
      </dl>
    </article>`;
  }).join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VaaniReel ${escapeHtml(task)} bakeoff</title>
  <style>
    body { max-width: 960px; margin: 0 auto; padding: 2rem; font-family: system-ui, sans-serif; background: #f7f4ed; color: #24211c; }
    main { display: grid; gap: 1.25rem; }
    article { padding: 1.25rem; border: 1px solid #d8d1c4; border-radius: 12px; background: white; }
    img, video { display: block; width: 100%; max-height: 620px; object-fit: contain; background: #eee; }
    audio { width: 100%; }
    dl div { display: flex; gap: .5rem; } dt { font-weight: 700; } dd { margin: 0; }
  </style>
</head>
<body>
  <h1>VaaniReel ${escapeHtml(task)} bakeoff</h1>
  <main>${cards || "<p>No completed results.</p>"}</main>
</body>
</html>
`;
  await writeFile(join(directory, "index.html"), html, "utf8");
}

async function askToSpend(maxCost) {
  const terminal = createInterface({ input, output });
  try {
    const answer = await terminal.question(`Spend up to $${maxCost.toFixed(2)}? (y/N) `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    terminal.close();
  }
}

async function executeBakeoff(task, prepared, maxCost) {
  if (!(await askToSpend(maxCost))) {
    console.log("Cancelled. Nothing was run.");
    return;
  }

  const directory = join("samples", "bakeoff", task);
  await mkdir(directory, { recursive: true });
  const results = [];
  let cumulativeCost = 0;

  for (const item of prepared) {
    const estimated = item.tool.parsedPrice.price;
    if (estimated !== null && cumulativeCost + estimated > maxCost) {
      console.log(`Stopping before ${modelName(item.tool)}: its estimated cost would exceed the budget.`);
      break;
    }

    console.log(`Running ${modelName(item.tool)}...`);
    try {
      const { taskResult, elapsedSeconds } = await runModel(item);
      const pexit = String(taskResult.pexit ?? "unknown");
      const actualCost = Number(taskResult.totalcost);
      const cost = Number.isFinite(actualCost) ? actualCost : 0;
      cumulativeCost += cost;
      const files = [];
      const outputs = Array.isArray(taskResult.outputs) ? taskResult.outputs : [];
      for (let index = 0; index < outputs.length; index += 1) {
        const url = outputs[index]?.url;
        if (!url) continue;
        try {
          const base = join(directory, `${safeFilename(modelName(item.tool))}-${index + 1}`);
          files.push(await downloadOutput(url, base));
        } catch (error) {
          console.error(`Could not save output ${index + 1} from ${modelName(item.tool)}: ${error.message}`);
        }
      }
      results.push({ model: modelName(item.tool), cost, elapsed: elapsedSeconds, pexit, files });
      console.log(`Finished with pexit=${pexit}, cost=$${cost.toFixed(4)}, total=$${cumulativeCost.toFixed(4)}.`);
      if (pexit !== "0") console.error(`${modelName(item.tool)} did not succeed (pexit must be "0").`);
      if (cumulativeCost > maxCost) {
        console.error(`Actual cumulative cost exceeded $${maxCost.toFixed(2)}. Stopping immediately.`);
        break;
      }
    } catch (error) {
      console.error(`${modelName(item.tool)} failed: ${error.message}`);
      // Runs are sequential and intentionally have no retries.
    }
  }

  await writeIndex(task, directory, results);
  console.log(`Results page: ${join(directory, "index.html")}`);
}

async function commandBakeoff(positionals, options) {
  const task = positionals[1];
  if (!TASKS[task]) fail("bakeoff task must be image, video, or tts.");
  const top = parseNumber(options.top ?? 3, "--top", { integer: true, min: 1 });
  const maxCost = parseNumber(options["max-cost"] ?? 1.5, "--max-cost", { min: 0 });

  let taskArguments = {};
  if (task === "tts") {
    const lang = positionals[2];
    const text = positionals[3];
    if (!lang || !text) fail('TTS usage: bakeoff tts <lang> "<text>"');
    if (positionals.length > 4) fail(`Unexpected argument: ${positionals[4]}`);
    taskArguments = { lang, text };
  } else if (positionals.length > 2) {
    fail(`Unexpected argument: ${positionals[2]}`);
  }

  if ((task === "image" || task === "video") && options.run) {
    try {
      await readFile(TASKS[task].sample);
    } catch {
      fail(`Required sample file not found: ${TASKS[task].sample}`);
    }
  }

  const prepared = await prepareBakeoff(task, top, taskArguments);
  if (prepared.length === 0) return;
  printBakeoffPlan(task, prepared, maxCost);
  if (options.run) await executeBakeoff(task, prepared, maxCost);
}

async function commandChoose(positionals) {
  const task = positionals[1];
  const chosenModel = positionals[2];
  if (!task || !chosenModel || !chosenModel.includes("/")) {
    fail("choose usage: choose <task> <owner/model>");
  }
  if (positionals.length > 3) fail(`Unexpected argument: ${positionals[3]}`);

  const detail = await getToolDetail(chosenModel);
  const parameterIds = parameterItems(detail).map(parameterId).filter(Boolean);
  const configDirectory = "config";
  const configPath = join(configDirectory, "models.json");
  let config = {};
  try {
    const existing = JSON.parse(await readFile(configPath, "utf8"));
    if (existing && typeof existing === "object" && !Array.isArray(existing)) config = existing;
    else fail(`${configPath} must contain a JSON object.`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      if (error instanceof SyntaxError) fail(`${configPath} contains invalid JSON.`);
      throw error;
    }
  }

  config[task] = { model: chosenModel, parameterIds };
  await mkdir(configDirectory, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`Saved ${chosenModel} for ${task} with ${parameterIds.length} parameter ID(s).`);
}

async function main() {
  const { positionals, options } = parseArguments(process.argv.slice(2));
  const command = positionals[0];
  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command === "categories") {
    if (positionals.length > 1) fail(`Unexpected argument: ${positionals[1]}`);
    await commandCategories();
  } else if (command === "find") {
    await commandFind(positionals, options);
  } else if (command === "bakeoff") {
    await commandBakeoff(positionals, options);
  } else if (command === "choose") {
    await commandChoose(positionals);
  } else {
    fail(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  if (error instanceof WiroError && error.details?.result === false) {
    const safeDetails = { ...error.details };
    delete safeDetails.key;
    delete safeDetails.apiKey;
    console.error(JSON.stringify(safeDetails, null, 2));
  }
  process.exitCode = 1;
});
