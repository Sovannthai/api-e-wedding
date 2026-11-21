// One-time Directus setup for the e-wedding API: the `guests` and `wishes`
// collections and a "Frontend" user whose static token the Nuxt server uses to
// look a guest up and to read and add wishes. Safe to re-run — anything that already exists is left alone.
//
//   node --env-file=.env scripts/setup.mjs
//
// The frontend token is printed at the end; put it in the Nuxt app's .env as
// NUXT_DIRECTUS_TOKEN.

// DIRECTUS_URL wins when set: inside the production container the API is
// reached on 127.0.0.1, not through its public address.
const URL = process.env.DIRECTUS_URL ?? process.env.PUBLIC_URL ?? "http://localhost:8055";
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
const FRONTEND_EMAIL = "frontend@e-wedding.com";

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

async function exists(path) {
  try {
    await api("GET", path);
    return true;
  } catch {
    return false;
  }
}

token = (await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).access_token;

// ── guests collection ────────────────────────────────────────────────────────
if (await exists("/collections/guests")) {
  console.log("guests collection already exists");
} else {
  await api("POST", "/collections", {
    collection: "guests",
    meta: {
      icon: "person",
      note: "Invited guests — each one gets a personal invitation link /<id>",
      display_template: "{{name}}",
      sort_field: "sort",
    },
    schema: {},
    fields: [
      {
        field: "id",
        type: "uuid",
        meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] },
        schema: { is_primary_key: true, length: 36, has_auto_increment: false },
      },
      {
        field: "name",
        type: "string",
        meta: {
          interface: "input",
          required: true,
          width: "half",
          note: "Shown on the envelope, e.g. លោក សុខ ចាន់ or Mr. Sok Chan",
        },
        schema: { is_nullable: false },
      },
      {
        field: "side",
        type: "string",
        meta: {
          interface: "select-dropdown",
          width: "half",
          display: "labels",
          options: {
            choices: [
              { text: "Groom", value: "groom" },
              { text: "Bride", value: "bride" },
            ],
          },
          display_options: {
            choices: [
              { text: "Groom", value: "groom", foreground: "#FFFFFF", background: "#2F6FDB" },
              { text: "Bride", value: "bride", foreground: "#FFFFFF", background: "#D94C8A" },
            ],
          },
        },
      },
      {
        field: "phone",
        type: "string",
        meta: { interface: "input", width: "half" },
      },
      {
        field: "invitation_link",
        type: "alias",
        meta: {
          interface: "presentation-notice",
          special: ["alias", "no-data"],
          width: "half",
          options: { text: "Invitation link: https://<your-site>/{{id}}" },
        },
      },
      {
        field: "note",
        type: "text",
        meta: { interface: "input-multiline", width: "full" },
      },
      { field: "sort", type: "integer", meta: { hidden: true, interface: "input" } },
      {
        field: "date_created",
        type: "timestamp",
        meta: { special: ["date-created"], interface: "datetime", readonly: true, hidden: true, width: "half" },
      },
      {
        field: "date_updated",
        type: "timestamp",
        meta: { special: ["date-updated"], interface: "datetime", readonly: true, hidden: true, width: "half" },
      },
    ],
  });
  console.log("created guests collection");
}

// Added after the first release: which guest list a guest came from — the
// sheet name in the invitation spreadsheet, e.g. "University PNC".
if (!(await exists("/fields/guests/group"))) {
  await api("POST", "/fields/guests", {
    field: "group",
    type: "string",
    meta: { interface: "input", width: "half", note: "Guest list this guest came from, e.g. University PNC" },
  });
  console.log("added guests.group field");
}

// ── wishes collection ────────────────────────────────────────────────────────
// The guestbook: blessings sent from the website. Every guest sees the
// published ones; set a wish to Hidden here to take it off the site.
if (await exists("/collections/wishes")) {
  console.log("wishes collection already exists");
} else {
  await api("POST", "/collections", {
    collection: "wishes",
    meta: {
      icon: "favorite",
      note: "Blessings sent from the website's guestbook",
      display_template: "{{name}} — {{message}}",
      sort: 2,
    },
    schema: {},
    fields: [
      {
        field: "id",
        type: "uuid",
        meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] },
        schema: { is_primary_key: true, length: 36, has_auto_increment: false },
      },
      {
        field: "status",
        type: "string",
        meta: {
          interface: "select-dropdown",
          width: "half",
          display: "labels",
          note: "Hidden wishes stay here but are not shown on the website",
          options: {
            choices: [
              { text: "Published", value: "published" },
              { text: "Hidden", value: "hidden" },
            ],
          },
          display_options: {
            choices: [
              { text: "Published", value: "published", foreground: "#FFFFFF", background: "#2E9D5B" },
              { text: "Hidden", value: "hidden", foreground: "#FFFFFF", background: "#8A8A8A" },
            ],
          },
        },
        schema: { default_value: "published", is_nullable: false },
      },
      {
        field: "name",
        type: "string",
        meta: { interface: "input", required: true, width: "half", note: "As the sender typed it" },
        schema: { is_nullable: false, max_length: 60 },
      },
      {
        field: "message",
        type: "text",
        meta: { interface: "input-multiline", required: true, width: "full" },
        schema: { is_nullable: false },
      },
      {
        field: "guest",
        type: "uuid",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          width: "half",
          display: "related-values",
          display_options: { template: "{{name}}" },
          options: { template: "{{name}}" },
          note: "Whose invitation link it was sent from — empty for the general link",
        },
      },
      {
        field: "date_created",
        type: "timestamp",
        meta: {
          special: ["date-created"],
          interface: "datetime",
          display: "datetime",
          display_options: { relative: true },
          readonly: true,
          width: "half",
        },
      },
    ],
  });
  // Deleting a guest keeps their wish; it just loses the link to them.
  await api("POST", "/relations", {
    collection: "wishes",
    field: "guest",
    related_collection: "guests",
    schema: { on_delete: "SET NULL" },
    meta: { sort_field: null },
  });
  console.log("created wishes collection");
}

// ── access for the Nuxt server ───────────────────────────────────────────────
// Only this token can read guests: the public role gets nothing, so the guest
// list can't be enumerated from the browser. The Nuxt server asks for just id
// and name, so phone and note never leave it.
let [policy] = await api("GET", "/policies?filter[name][_eq]=Frontend&fields=id");
if (!policy) {
  policy = await api("POST", "/policies", {
    name: "Frontend",
    icon: "public",
    description: "Used by the wedding website's server: reads guests, reads and adds wishes",
    app_access: false,
    admin_access: false,
  });
  console.log("created Frontend policy");
}

// All fields and no item rule: the Directus Community licence restricts
// field- and item-level permission rules. The Nuxt server picks the fields
// and filters hidden wishes itself.
const GRANTS = [
  ["guests", "read"],
  ["wishes", "read"],
  ["wishes", "create"],
];
for (const [collection, action] of GRANTS) {
  const [permission] = await api(
    "GET",
    `/permissions?filter[policy][_eq]=${policy.id}&filter[collection][_eq]=${collection}` +
      `&filter[action][_eq]=${action}&fields=id`
  );
  if (permission) continue;
  await api("POST", "/permissions", {
    policy: policy.id,
    collection,
    action,
    fields: ["*"],
    permissions: null,
  });
  console.log(`granted Frontend ${action} on ${collection}`);
}

let [role] = await api("GET", "/roles?filter[name][_eq]=Frontend&fields=id");
if (!role) {
  role = await api("POST", "/roles", { name: "Frontend", icon: "public", policies: [{ policy: policy.id }] });
  console.log("created Frontend role");
}

// Directus never reads a static token back, so it is only printed the run
// that creates it. To issue a new one, regenerate it on the user in the admin app.
const [user] = await api("GET", `/users?filter[email][_eq]=${FRONTEND_EMAIL}&fields=id`);
if (user) {
  console.log("frontend user already exists — its token was printed when it was created");
} else {
  const userToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  await api("POST", "/users", {
    first_name: "Wedding",
    last_name: "Website",
    email: FRONTEND_EMAIL,
    role: role.id,
    token: userToken,
  });
  console.log(`created frontend user\n\nNUXT_DIRECTUS_TOKEN=${userToken}`);
}
