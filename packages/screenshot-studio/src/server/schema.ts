import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled"),
  store: text("store").notNull(),
  presetId: text("preset_id").notNull(),
  sliceCount: integer("slice_count").notNull(),
  background: text("background").notNull(),
  collections: text("collections"),
});

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
});

export const events = sqliteTable("edit_log", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull(),
  ts: text("ts").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  nodeId: text("node_id").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  detail: text("detail").notNull(),
});
