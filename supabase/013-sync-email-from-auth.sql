-- 013-sync-email-from-auth
-- Server-side trigger to sync auth.users.email -> profiles.email
-- whenever a user confirms an email address change.
-- Replaces the client-side onAuthStateChange('USER_UPDATED') approach
-- which only fires if the app is open in the confirming browser.

CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_email_from_auth();
