// Imports one sheet of the guest invitation spreadsheet (exported as CSV) into
// the `guests` collection. Every guest gets the sheet's name as their group.
//
//   node --env-file=.env scripts/import-guests.mjs <file.csv> "<group>"
//
// Rows are matched by name within the group, so re-running after the sheet
// changes only adds the new guests. Columns used: Name, Phone Number, Remark.

import { readFileSync } from "node:fs";

const [file, group] = process.argv.slice(2);
if (!file || !group) {
  console.error('usage: node --env-file=.env scripts/import-guests.mjs <file.csv> "<group>"');
  process.exit(1);
}

const URL = process.env.PUBLIC_URL ?? "http://localhost:8055";
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

let token;

async function api(method, path, body) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const json = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

// RFC 4180: quoted fields may hold commas, newlines and "" for a quote.
function parseCsv(text) {
  const rows = [[]];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") rows.at(-1).push(field), (field = "");
    else if (c === "\n") rows.at(-1).push(field), (field = ""), rows.push([]);
    else if (c !== "\r") field += c;
  }
  rows.at(-1).push(field);
  return rows;
}

const rows = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));

// The sheet has blank rows above its header, so find the header by its Name cell.
const headerAt = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === "name"));
if (headerAt < 0) throw new Error("no header row with a Name column");
const header = rows[headerAt].map((c) => c.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const [nameCol, phoneCol, remarkCol] = [col("name"), col("phone number"), col("remark")];

const guests = rows
  .slice(headerAt + 1)
  .map((r) => ({
    name: r[nameCol]?.trim() ?? "",
    phone: (phoneCol >= 0 && r[phoneCol]?.trim()) || null,
    note: (remarkCol >= 0 && r[remarkCol]?.trim()) || null,
    group,
  }))
  .filter((g) => g.name);

token = (await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).access_token;

const existing = await api(
  "GET",
  `/items/guests?filter[group][_eq]=${encodeURIComponent(group)}&fields=name&limit=-1`
);
const known = new Set(existing.map((g) => g.name));
const toCreate = guests.filter((g) => !known.has(g.name));

if (toCreate.length) await api("POST", "/items/guests", toCreate);

console.log(
  `${group}: ${guests.length} guests in sheet, ${toCreate.length} imported, ` +
    `${guests.length - toCreate.length} already there`
);
