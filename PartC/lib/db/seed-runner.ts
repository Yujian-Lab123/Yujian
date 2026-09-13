import { db } from './client';
import { contents, currentStates, users } from './schema';
import { SEED_CONTENTS, SEED_USERS } from './seed';
import { computeUserVectors } from './index';
import { vec } from '../axes';
import { encodeCurrentState } from '../current-state/privacy';

export async function seedDatabase(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const user of SEED_USERS) {
      await tx.insert(users).values({
        id: user.id,
        zhihuUserId: `zhihu-${user.id}`,
        name: user.name,
        role: user.role,
        city: user.city,
        quote: user.quote,
        tags: user.tags,
        intents: user.intents,
        zhihuYears: user.zhihu_years,
        upvotes: user.upvotes,
        encounterEnabled: true,
        autoReciprocate: Boolean(user.auto_reciprocate),
        isMock: true,
      }).onConflictDoNothing();
      if (user.current_state) {
        await tx.insert(currentStates).values({
          id: `cs-${user.id}`,
          userId: user.id,
          text: encodeCurrentState(user.current_state),
          mood: user.current_state.mood,
        }).onConflictDoUpdate({
          target: currentStates.id,
          set: {
            text: encodeCurrentState(user.current_state),
            mood: user.current_state.mood,
            expiresAt: null,
          },
        });
      }
    }
    for (const content of SEED_CONTENTS) {
      await tx.insert(contents).values({
        id: content.id,
        userId: content.user_id,
        contentType: content.type,
        title: content.title,
        chars: content.chars,
        minutes: content.minutes,
        summary: content.summary,
        excerpt: content.excerpt,
        url: `https://zhihu.com/mock/${content.id}`,
        topics: content.topics,
        vec: vec(content.v),
        isAnchor: Boolean(content.anchor),
        publishedAt: new Date(`${content.published_at}T00:00:00.000Z`),
      }).onConflictDoNothing();
    }
  });
  for (const user of SEED_USERS) await computeUserVectors(user.id);
}
