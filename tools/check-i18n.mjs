#!/usr/bin/env node
/**
 * Verifies that every locale defines the same message keys and keeps the
 * $1..$9 placeholders used by the English source catalog.
 *
 * Usage: node tools/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "_locales");
const BASE_LOCALE = "en";
const SCAN_EXTENSIONS = new Set([".js", ".html", ".json"]);
const SKIP_DIRECTORIES = new Set([
  "_locales",
  "assets",
  "tools",
  "node_modules",
  ".git",
]);

const errors = [];
const warnings = [];
const dynamicPrefixes = new Set();

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${relative(root, path)}: invalid JSON (${error.message})`);
    return null;
  }
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry)) continue;
      walk(fullPath, files);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectUsedKeys() {
  const used = new Map();

  const add = (key, source) => {
    if (!used.has(key)) used.set(key, new Set());
    used.get(key).add(relative(root, source));
  };

  for (const file of walk(root)) {
    const content = readFileSync(file, "utf8");
    const extension = file.slice(file.lastIndexOf("."));

    if (extension === ".html") {
      const attributePattern =
        /data-i18n(?:-html|-title|-placeholder|-alt)?\s*=\s*"([A-Za-z0-9_]+)"/g;
      for (const match of content.matchAll(attributePattern)) {
        add(match[1], file);
      }
    }

    if (extension === ".js") {
      const callPattern =
        /\b(?:t|i18nT)\(\s*["']([A-Za-z0-9_]+)["']/g;
      for (const match of content.matchAll(callPattern)) {
        add(match[1], file);
      }

      const labelPattern =
        /\bsetActionLabel\([^,]+,\s*["']([A-Za-z0-9_]+)["']/g;
      for (const match of content.matchAll(labelPattern)) {
        add(match[1], file);
      }

      const ternaryPattern =
        /\bt\(\s*[^"'`]*\?\s*["']([A-Za-z0-9_]+)["']\s*:\s*["']([A-Za-z0-9_]+)["']/g;
      for (const match of content.matchAll(ternaryPattern)) {
        add(match[1], file);
        add(match[2], file);
      }

      if (content.includes("`setting${")) {
        dynamicPrefixes.add("setting");
      }
    }

    if (file.endsWith("manifest.json")) {
      const manifestPattern = /__MSG_([A-Za-z0-9_]+)__/g;
      for (const match of content.matchAll(manifestPattern)) {
        add(match[1], file);
      }
    }
  }

  return used;
}

function placeholdersOf(message) {
  const withoutEscapedDollars = String(message).replace(/\$\$/g, "");
  return new Set(
    [...withoutEscapedDollars.matchAll(/\$(\d)/g)].map((match) => match[1])
  );
}

function loadLocales() {
  if (!existsSync(localesDir)) {
    fail("_locales directory is missing");
    return new Map();
  }

  const index = readJson(join(localesDir, "languages.json"));
  const locales = new Map();

  for (const entry of readdirSync(localesDir)) {
    const localePath = join(localesDir, entry);
    if (!statSync(localePath).isDirectory()) continue;
    const messages = readJson(join(localePath, "messages.json"));
    if (!messages) continue;
    locales.set(entry, messages);

    if (index && !index[entry]) {
      warn(
        `_locales/${entry} is not listed in _locales/languages.json (hidden from the language selector)`
      );
    }
  }

  if (index && !locales.has(BASE_LOCALE)) {
    fail(`base locale "${BASE_LOCALE}" is missing`);
  }

  return locales;
}

const usedKeys = collectUsedKeys();
const locales = loadLocales();
const baseMessages = locales.get(BASE_LOCALE) || {};
const baseKeys = Object.keys(baseMessages);

for (const key of usedKeys.keys()) {
  if (!baseKeys.includes(key)) {
    fail(
      `missing key "${key}" in _locales/${BASE_LOCALE}/messages.json (used in ${[
        ...usedKeys.get(key),
      ].join(", ")})`
    );
  }
}

for (const [locale, messages] of locales) {
  const keys = Object.keys(messages);

  for (const key of baseKeys) {
    if (!keys.includes(key)) {
      fail(`missing key "${key}" in _locales/${locale}/messages.json`);
      continue;
    }

    const basePlaceholders = placeholdersOf(baseMessages[key].message);
    const localePlaceholders = placeholdersOf(messages[key].message);

    for (const digit of basePlaceholders) {
      if (!localePlaceholders.has(digit)) {
        fail(
          `_locales/${locale}/messages.json: "${key}" is missing placeholder $${digit}`
        );
      }
    }

    for (const digit of localePlaceholders) {
      if (!basePlaceholders.has(digit)) {
        fail(
          `_locales/${locale}/messages.json: "${key}" uses placeholder $${digit} that is not in the English message`
        );
      }
    }
  }

  for (const key of keys) {
    if (!baseKeys.includes(key)) {
      warn(
        `_locales/${locale}/messages.json: unused key "${key}" (not in the English catalog)`
      );
    }
  }
}

function buildDynamicKey(key) {
  for (const prefix of dynamicPrefixes) {
    if (key.startsWith(prefix) && /[A-Z]/.test(key.charAt(prefix.length))) {
      return true;
    }
  }
  return false;
}

for (const key of baseKeys) {
  if (!usedKeys.has(key) && !buildDynamicKey(key)) {
    warn(`_locales/${BASE_LOCALE}/messages.json: key "${key}" is not referenced anywhere`);
  }
}

const localeList = [...locales.keys()].join(", ");
console.log(`Locales: ${localeList}`);
console.log(`Keys in ${BASE_LOCALE}: ${baseKeys.length}`);
console.log(`Referenced keys: ${usedKeys.size}`);

for (const message of warnings) {
  console.warn(`warning: ${message}`);
}

if (errors.length) {
  for (const message of errors) {
    console.error(`error: ${message}`);
  }
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

console.log(`\nAll ${locales.size} locale catalogs are consistent.`);
