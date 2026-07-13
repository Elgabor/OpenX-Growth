import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  threadJson: text("thread_json"),
  status: text("status", { enum:["draft","scheduled","publishing","published","failed","needs_review"] }).notNull().default("draft"),
  scheduledAt: integer("scheduled_at"),
  publishedAt: integer("published_at"),
  xPostId: text("x_post_id"),
  publishedIdsJson: text("published_ids_json"),
  publishReceiptsJson: text("publish_receipts_json"),
  claimToken: text("claim_token"),
  claimExpiresAt: integer("claim_expires_at"),
  deliveryState: text("delivery_state",{enum:["idle","sending","accepted","confirmed","ambiguous"]}).notNull().default("idle"),
  topic: text("topic"),
  format: text("format").notNull().default("post"),
  hook: text("hook"),
  generated: integer("generated",{mode:"boolean"}).notNull().default(false),
  evergreen: integer("evergreen",{mode:"boolean"}).notNull().default(false),
  evergreenIntervalDays: integer("evergreen_interval_days").notNull().default(30),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [index("posts_status_scheduled_idx").on(table.status,table.scheduledAt)]);

export const publishEvents=sqliteTable("publish_events",{
  id:text("id").primaryKey(),
  postId:text("post_id").notNull(),
  eventType:text("event_type",{enum:["claim_acquired","claim_recovered","provider_request","provider_response","receipt_persisted","retry","reconciliation","terminal_failure","needs_review","published"]}).notNull(),
  partIndex:integer("part_index"),
  providerStatus:integer("provider_status"),
  detailCode:text("detail_code"),
  occurredAt:integer("occurred_at").notNull(),
},(table)=>[index("publish_events_post_occurred_idx").on(table.postId,table.occurredAt)]);

export const analyticsSnapshots = sqliteTable("analytics_snapshots", {
  id: integer("id").primaryKey({autoIncrement:true}),
  postId: text("post_id").notNull(),
  recordedAt: integer("recorded_at").notNull(),
  impressions: integer("impressions").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  bookmarks: integer("bookmarks").notNull().default(0),
}, (table) => [index("analytics_post_recorded_idx").on(table.postId,table.recordedAt)]);

export const followerSnapshots = sqliteTable("follower_snapshots", {
  id: integer("id").primaryKey({autoIncrement:true}),
  accountId: text("account_id").notNull(),
  recordedAt: integer("recorded_at").notNull(),
  followers: integer("followers").notNull(),
}, (table) => [index("followers_account_recorded_idx").on(table.accountId,table.recordedAt)]);

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  targetType: text("target_type",{enum:["idea","reply"]}).notNull(),
  targetId: text("target_id").notNull(),
  vote: integer("vote").notNull(),
  contextJson: text("context_json"),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("feedback_target_idx").on(table.targetType,table.targetId)]);

export const syncCache = sqliteTable("sync_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  expiresAt: integer("expires_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const apiUsage = sqliteTable("api_usage", {
  day: text("day").primaryKey(),
  reads: integer("reads").notNull().default(0),
  requests: integer("requests").notNull().default(0),
  resources: integer("resources").notNull().default(0),
  reservedResources: integer("reserved_resources").notNull().default(0),
  writes: integer("writes").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const xUsageEvents = sqliteTable("x_usage_events", {
  id:text("id").primaryKey(),
  day:text("day").notNull(),
  endpoint:text("endpoint").notNull(),
  kind:text("kind",{enum:["read","write","request"]}).notNull(),
  requestCount:integer("request_count").notNull(),
  resourceCount:integer("resource_count").notNull(),
  writeCount:integer("write_count").notNull(),
  status:integer("status").notNull(),
  rateLimit:integer("rate_limit"),
  rateRemaining:integer("rate_remaining"),
  rateResetAt:integer("rate_reset_at"),
  occurredAt:integer("occurred_at").notNull(),
},(table)=>[index("x_usage_day_occurred_idx").on(table.day,table.occurredAt)]);

export const secureStore = sqliteTable("secure_store", {
  key: text("key").primaryKey(),
  sealedValue: text("sealed_value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
