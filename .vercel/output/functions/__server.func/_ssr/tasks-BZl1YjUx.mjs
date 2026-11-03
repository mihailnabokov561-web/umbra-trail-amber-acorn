import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tasks-BZl1YjUx.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var _0002_tasks_default = "-- Task tracker. A task is a title plus one status.\n-- position/timestamps are bookkeeping so the board can order cards\n-- and the ledger can show that a row actually changed.\n\ncreate table if not exists tasks (\n  id         serial primary key,\n  title      text not null check (char_length(trim(title)) between 1 and 180),\n  status     text not null check (status in ('to do', 'in progress', 'done')),\n  updated_at timestamptz not null default now()\n);\n\ncreate index if not exists tasks_status_idx on tasks (status);\n\ncreate table if not exists task_events (\n  id         serial primary key,\n  task_id    integer,\n  action     text not null,\n  sql_text   text not null,\n  detail     text not null,\n  created_at timestamptz not null default now()\n);\n\ninsert into tasks (title, status) values\n  ('Придумать название релиза', 'to do'),\n  ('Проверить удаление из To do', 'to do'),\n  ('Перетащить карточку между колонками', 'in progress'),\n  ('Подключить таблицу tasks', 'done');\n\ninsert into task_events (task_id, action, sql_text, detail)\nvalues (\n  null,\n  'migrate',\n  E'create table tasks (\\n  id serial primary key,\\n  title text not null,\\n  status text not null check (status in (''to do'', ''in progress'', ''done'')),\\n  updated_at timestamptz not null default now()\\n);',\n  'Схема применена. Соединение с Postgres есть, таблицы tasks и task_events созданы.'\n);\n";
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
var databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
/**
* Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
* sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
* the app has a working database even with nothing configured — the live preview
* included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
*/
var dbSource = databaseUrl ? "neon" : "pglite";
/**
* Init state lives on globalThis as promises: dev HMR creates new instances of
* this module, and two instances racing module-level state would open a second
* pool or run two concurrent PGLite migration passes (whose duplicate
* `_migrations` insert rejects — and would get memoized, poisoning every later
* `getSql()`). A failed init clears its slot so the next call retries.
*/
var globalRef = globalThis;
/**
* Result-type parity: Postgres sends every value as text plus a type OID — the
* JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
* int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
* JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
* production return identical, JSON-safe shapes:
*   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
*                                   `::text` if you ever need huge integers)
*   date                         -> 'YYYY-MM-DD' string
*   interval                     -> Postgres interval text
* numeric already comes back as a string on both (arbitrary precision).
*/
var OID_INT8 = 20;
var OID_DATE = 1082;
var OID_INTERVAL = 1186;
var identity = (v) => v;
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({ "/migrations/0002_tasks.sql": _0002_tasks_default });
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
var sqlPromise = null;
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var globalBoot = globalThis;
if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
	globalBoot.__pgBootstrapPromise__ = void 0;
	console.error("[db] PGLite bootstrap failed:", err);
	throw err;
});
var STATUSES = [
	"to do",
	"in progress",
	"done"
];
function isStatus(value) {
	return STATUSES.includes(value);
}
function fail(error) {
	return {
		ok: false,
		error
	};
}
function errorText(err) {
	if (err instanceof Error && err.message) return err.message;
	return "Не получилось записать в базу";
}
function asNumber(value, label) {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(n)) throw new Error(`${label} вернулся не числом`);
	return n;
}
function parseId(id) {
	const n = typeof id === "number" ? id : Number(id);
	if (!Number.isInteger(n) || n <= 0) throw new Error("Некорректный идентификатор задачи");
	return n;
}
function parseTitle(title) {
	if (typeof title !== "string") throw new Error("Название должно быть строкой");
	const trimmed = title.trim();
	if (!trimmed) throw new Error("Введите название");
	if (trimmed.length > 180) throw new Error("Название длиннее 180 символов");
	return trimmed;
}
function parseStatus(status) {
	if (typeof status !== "string" || !isStatus(status)) throw new Error("Статус может быть только to do, in progress или done");
	return status;
}
function asTask(row) {
	return {
		id: asNumber(row.id, "id"),
		title: row.title,
		status: parseStatus(row.status),
		updated_at: row.updated_at
	};
}
async function readBoard() {
	const sql = await getSql();
	const tasks = await sql`
    select id, title, status, updated_at::text as updated_at
    from tasks
    order by id
  `;
	const events = await sql`
    select id, task_id, action, sql_text, detail, created_at::text as created_at
    from task_events
    order by id desc
    limit 20
  `;
	return {
		source: dbSource,
		tasks: tasks.map(asTask),
		events: events.map((row) => ({
			id: asNumber(row.id, "id события"),
			task_id: row.task_id == null ? null : asNumber(row.task_id, "task_id"),
			action: row.action,
			sql_text: row.sql_text,
			detail: row.detail,
			created_at: row.created_at
		}))
	};
}
async function record(sql, taskId, action, sqlText, detail) {
	await sql`
    insert into task_events (task_id, action, sql_text, detail)
    values (${taskId}, ${action}, ${sqlText}, ${detail})
  `;
}
var getBoard_createServerFn_handler = createServerRpc({
	id: "493f771b655b5673b8610b879d538e33d2dc9388ea15b64e1a3069b326d5718b",
	name: "getBoard",
	filename: "src/lib/tasks.ts"
}, (opts) => getBoard.__executeServer(opts));
var getBoard = createServerFn({ method: "GET" }).handler(getBoard_createServerFn_handler, async () => {
	return readBoard();
});
var createTask_createServerFn_handler = createServerRpc({
	id: "a5bf4681e69d8874a10e0ef347b00c7f0821bf7043f8afa40801854a7bc57b67",
	name: "createTask",
	filename: "src/lib/tasks.ts"
}, (opts) => createTask.__executeServer(opts));
var createTask = createServerFn({ method: "POST" }).validator((input) => input).handler(createTask_createServerFn_handler, async ({ data }) => {
	try {
		const title = parseTitle(data?.title);
		const sql = await getSql();
		const id = asNumber((await sql`
        insert into tasks (title, status)
        values (${title}, 'to do')
        returning id
      `)[0]?.id, "id");
		await record(sql, id, "insert", `insert into tasks (title, status)\nvalues ($1, 'to do')\nreturning id;\n\n$1 = ${title}`, `Создана задача #${id} со статусом to do`);
		return {
			ok: true,
			board: await readBoard()
		};
	} catch (err) {
		return fail(errorText(err));
	}
});
var renameTask_createServerFn_handler = createServerRpc({
	id: "81f6f9c980e82ada8bb07ee645985c614c3716908db1f30e1321ebf8d2d0067a",
	name: "renameTask",
	filename: "src/lib/tasks.ts"
}, (opts) => renameTask.__executeServer(opts));
var renameTask = createServerFn({ method: "POST" }).validator((input) => input).handler(renameTask_createServerFn_handler, async ({ data }) => {
	try {
		const body = data;
		const id = parseId(body?.id);
		const title = parseTitle(body?.title);
		const sql = await getSql();
		const current = (await sql`
        select status from tasks where id = ${id}
      `)[0];
		if (!current) return fail("Задача не найдена");
		if (current.status !== "in progress") return fail("Редактировать можно только задачу в статусе in progress");
		if (!(await sql`
        update tasks
        set title = ${title}, updated_at = now()
        where id = ${id} and status = 'in progress'
        returning id
      `)[0]) return fail("Не удалось обновить задачу");
		await record(sql, id, "update", `update tasks\nset title = $1, updated_at = now()\nwhere id = $2 and status = 'in progress';\n\n$1 = ${title}\n$2 = ${id}`, `Изменено название задачи #${id}`);
		return {
			ok: true,
			board: await readBoard()
		};
	} catch (err) {
		return fail(errorText(err));
	}
});
var deleteTask_createServerFn_handler = createServerRpc({
	id: "c559386a21dd47ad490ab40d4d409785d6ab536eca39014681e23f3cec95e387",
	name: "deleteTask",
	filename: "src/lib/tasks.ts"
}, (opts) => deleteTask.__executeServer(opts));
var deleteTask = createServerFn({ method: "POST" }).validator((input) => input).handler(deleteTask_createServerFn_handler, async ({ data }) => {
	try {
		const id = parseId(data?.id);
		const sql = await getSql();
		const current = (await sql`
        select status, title from tasks where id = ${id}
      `)[0];
		if (!current) return fail("Задача не найдена");
		if (current.status === "done") return fail("Задачу в done нельзя удалить");
		if (!(await sql`
        delete from tasks
        where id = ${id} and status in ('to do', 'in progress')
        returning id
      `)[0]) return fail("Не удалось удалить задачу");
		await record(sql, id, "delete", `delete from tasks\nwhere id = $1 and status in ('to do', 'in progress');\n\n$1 = ${id}`, `Удалена задача #${id} «${current.title}» (${current.status})`);
		return {
			ok: true,
			board: await readBoard()
		};
	} catch (err) {
		return fail(errorText(err));
	}
});
var moveTask_createServerFn_handler = createServerRpc({
	id: "db07159ca15a9cc6be147ab6c1775236944342cca5e5a6f84a29926f0fad2d18",
	name: "moveTask",
	filename: "src/lib/tasks.ts"
}, (opts) => moveTask.__executeServer(opts));
var moveTask = createServerFn({ method: "POST" }).validator((input) => input).handler(moveTask_createServerFn_handler, async ({ data }) => {
	try {
		const body = data;
		const id = parseId(body?.id);
		const status = parseStatus(body?.status);
		const sql = await getSql();
		const current = (await sql`
        select status, title from tasks where id = ${id}
      `)[0];
		if (!current) return fail("Задача не найдена");
		if (current.status === "done") return fail("Задачу в done нельзя переносить, редактировать или удалять");
		if (current.status === status) return {
			ok: true,
			board: await readBoard()
		};
		if (!(await sql`
        update tasks
        set status = ${status}, updated_at = now()
        where id = ${id} and status <> 'done'
        returning id
      `)[0]) return fail("Не удалось перенести задачу");
		await record(sql, id, "update", `update tasks\nset status = $1, updated_at = now()\nwhere id = $2 and status <> 'done';\n\n$1 = ${status}\n$2 = ${id}`, `Задача #${id} «${current.title}»: ${current.status} → ${status}`);
		return {
			ok: true,
			board: await readBoard()
		};
	} catch (err) {
		return fail(errorText(err));
	}
});
//#endregion
export { createTask_createServerFn_handler, deleteTask_createServerFn_handler, getBoard_createServerFn_handler, moveTask_createServerFn_handler, renameTask_createServerFn_handler };
