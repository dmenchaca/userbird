-- Add policy for service role to read notification settings
CREATE POLICY "Service role can read notification settings"
ON notification_settings
FOR SELECT
TO service_role
USING (true);

-- Grant necessary permissions
GRANT SELECT ON notification_settings TO service_role;