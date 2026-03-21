-- =============================================================================
-- xTimeBox - Migration 002: Add contact fields to profiles
-- =============================================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- =============================================================================

-- Add new contact fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false;

-- Update existing profiles to mark them as complete (they were created before this requirement)
UPDATE profiles SET profile_complete = true WHERE full_name IS NOT NULL AND full_name != '';

-- Update the handle_new_user trigger to include the new fields and handle Google metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, phone, company, profile_complete)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'company',
    -- Mark complete only if registered via the sign-up form (has phone/company in metadata)
    CASE
      WHEN NEW.raw_user_meta_data ->> 'phone' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'company' IS NOT NULL
      THEN true
      ELSE false
    END
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
