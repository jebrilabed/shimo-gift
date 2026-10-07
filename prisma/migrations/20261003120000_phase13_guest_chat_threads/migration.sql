-- Guest ownership is shared by multiple conversations for one opaque cookie hash.
DROP INDEX IF EXISTS "chat_conversations_guestTokenHash_key";

CREATE INDEX "chat_conversations_guestTokenHash_updatedAt_idx"
ON "chat_conversations"("guestTokenHash", "updatedAt");
