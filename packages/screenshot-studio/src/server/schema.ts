import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Current screenshot holders. */
export const frames = sqliteTable("frames", {
  id: text("id").primaryKey(),
  store: text("store").notNull(),
  presetId: text("preset_id").notNull(),
  label: text("label").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
});

/** Append-only edit log. One row per finished gesture. */
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull(),
  ts: text("ts").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  frameId: text("frame_id").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  store: text("store").notNull(),
  presetId: text("preset_id").notNull(),
  frameLabel: text("frame_label").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
});
