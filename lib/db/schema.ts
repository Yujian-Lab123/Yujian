import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const profileJobStatus = pgEnum('profile_job_status', ['queued', 'running', 'succeeded', 'failed']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  zhihuUserId: text('zhihu_user_id').unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default(''),
  city: text('city').notNull().default(''),
  quote: text('quote').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  intents: jsonb('intents').$type<string[]>().notNull().default([]),
  zhihuYears: integer('zhihu_years').notNull().default(0),
  upvotes: text('upvotes').notNull().default('0'),
  encounterEnabled: boolean('encounter_enabled').notNull().default(true),
  autoReciprocate: boolean('auto_reciprocate').notNull().default(false),
  isMock: boolean('is_mock').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contents = pgTable('contents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull().default(''),
  title: text('title').notNull().default(''),
  chars: integer('chars').notNull().default(0),
  minutes: integer('minutes').notNull().default(0),
  summary: text('summary').notNull().default(''),
  excerpt: text('excerpt').notNull().default(''),
  url: text('url').notNull().default(''),
  topics: jsonb('topics').$type<string[]>().notNull().default([]),
  vec: jsonb('vec').$type<number[]>().notNull().default([]),
  isAnchor: boolean('is_anchor').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (table) => [index('contents_user_published_idx').on(table.userId, table.publishedAt)]);

export const userVectors = pgTable('user_vectors', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  longTerm: jsonb('long_term').$type<number[]>().notNull().default([]),
  value: jsonb('value').$type<number[]>().notNull().default([]),
  conversation: jsonb('conversation').$type<number[]>().notNull().default([]),
  current: jsonb('current').$type<number[] | null>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const currentStates = pgTable('current_states', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull().default(''),
  mood: text('mood').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => [index('current_states_user_created_idx').on(table.userId, table.createdAt)]);

export const recommendations = pgTable('recommendations', {
  id: text('id').primaryKey(),
  viewerId: text('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scores: jsonb('scores').$type<Record<string, number>>().notNull().default({}),
  anchorId: text('anchor_id').references(() => contents.id, { onDelete: 'set null' }),
  reason: jsonb('reason').$type<Record<string, unknown>>().notNull().default({}),
  bridge: jsonb('bridge').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('fresh'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('recommendations_viewer_created_idx').on(table.viewerId, table.createdAt),
  uniqueIndex('recommendations_fresh_pair_uidx').on(table.viewerId, table.targetId, table.status),
]);

export const feedback = pgTable('feedback', {
  id: text('id').primaryKey(),
  recommendationId: text('rec_id').notNull().references(() => recommendations.id, { onDelete: 'cascade' }),
  viewerId: text('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('feedback_viewer_created_idx').on(table.viewerId, table.createdAt)]);

export const connectionIntents = pgTable('connection_intents', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toId: text('to_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recommendationId: text('rec_id').references(() => recommendations.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('connection_intents_direction_uidx').on(table.fromId, table.toId),
  index('connection_intents_from_status_idx').on(table.fromId, table.status),
]);

export const connections = pgTable('connections', {
  id: text('id').primaryKey(),
  pairKey: text('pair_key').notNull(),
  userA: text('user_a').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userB: text('user_b').notNull().references(() => users.id, { onDelete: 'cascade' }),
  shared: jsonb('shared').$type<string[]>().notNull().default([]),
  questionContentId: text('question').references(() => contents.id, { onDelete: 'set null' }),
  bridge: jsonb('bridge').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('connections_pair_key_uidx').on(table.pairKey),
  index('connections_user_a_idx').on(table.userA),
  index('connections_user_b_idx').on(table.userB),
]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [index('sessions_user_idx').on(table.userId)]);

export const externalIdentities = pgTable('external_identities', {
  provider: text('provider').notNull(),
  externalUserId: text('external_user_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  encryptedAccessToken: text('encrypted_access_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default({}),
  rawContents: jsonb('raw_contents').$type<unknown[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('external_identities_provider_user_uidx').on(table.provider, table.externalUserId),
  index('external_identities_user_idx').on(table.userId),
]);

export const profileArtifacts = pgTable('profile_artifacts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  subjectName: text('subject_name').notNull(),
  artifact: jsonb('artifact').$type<Record<string, unknown>>().notNull(),
  // 画像广场：用户自愿公开的时间。null = 私有（默认），仅在本人明确开启后进入画像长廊。
  sharedAt: timestamp('shared_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profileJobs = pgTable('profile_jobs', {
  id: text('id').primaryKey(),
  requestedBy: text('requested_by').references(() => users.id, { onDelete: 'set null' }),
  status: profileJobStatus('status').notNull().default('queued'),
  inputFile: text('input_file').notNull(),
  subjectName: text('subject_name').notNull(),
  options: jsonb('options').$type<{ maxItems?: number; maxChars?: number }>().notNull().default({}),
  message: text('message').notNull().default('已进入队列'),
  progress: jsonb('progress').$type<Record<string, unknown> | null>(),
  artifactSlug: text('artifact_slug'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  heartbeatAt: timestamp('heartbeat_at', { withTimezone: true }),
}, (table) => [index('profile_jobs_status_created_idx').on(table.status, table.createdAt)]);

export const serviceHeartbeats = pgTable('service_heartbeats', {
  name: text('name').primaryKey(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
});
