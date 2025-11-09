-- Birthday System Migration for Production
-- Run this manually on production database

-- 1. Add new column to birthday_greeting_history
ALTER TABLE birthday_greeting_history 
ADD COLUMN IF NOT EXISTS twilio_image_sid TEXT;

-- 2. Create birthday_pending_messages table
CREATE TABLE IF NOT EXISTS birthday_pending_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  greeting_history_id VARCHAR NOT NULL REFERENCES birthday_greeting_history(id) ON DELETE CASCADE,
  
  mms_sid TEXT NOT NULL UNIQUE,
  sms_body TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  image_url TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_birthday_pending_mms_sid 
ON birthday_pending_messages(mms_sid);

-- Verify tables exist
SELECT 'birthday_greeting_history' as table_name, COUNT(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'birthday_greeting_history' AND column_name = 'twilio_image_sid'
UNION ALL
SELECT 'birthday_pending_messages', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'birthday_pending_messages';
