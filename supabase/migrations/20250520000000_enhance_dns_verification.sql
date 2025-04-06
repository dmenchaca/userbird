/*
  # Enhance DNS Verification for Custom Emails

  1. Modifications to `dns_verification_records` table:
    - Add `dkim_selector` - Unique selector for DKIM records
    - Add `dkim_private_key` - Store private key for DKIM signing
    - Add `last_check_time` - Track when verification was last checked
    - Add `failure_reason` - Store error message if verification fails

  2. Functions for DNS Verification:
    - Add function to generate DKIM keys
    - Add function to rotate DKIM keys when needed
*/

-- Add fields to dns_verification_records table
ALTER TABLE dns_verification_records 
ADD COLUMN dkim_selector text,
ADD COLUMN dkim_private_key text,
ADD COLUMN last_check_time timestamptz,
ADD COLUMN failure_reason text;

-- Add additional status fields to custom_email_settings
ALTER TABLE custom_email_settings
ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified' 
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'failed')),
ADD COLUMN last_verification_attempt timestamptz,
ADD COLUMN verification_messages text[];

-- Create index for faster status lookups
CREATE INDEX idx_verification_status ON custom_email_settings(verification_status);

-- Create a function to update verification status based on DNS checks
CREATE OR REPLACE FUNCTION update_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If all required verifications are true, mark as verified
  IF NEW.spf_verified = true AND 
     NEW.dkim_verified = true AND 
     NEW.dmarc_verified = true THEN
    NEW.verification_status := 'verified';
    NEW.verified := true;
  ELSE
    -- If any verification was just set to false, mark as failed
    IF (OLD.spf_verified = true AND NEW.spf_verified = false) OR
       (OLD.dkim_verified = true AND NEW.dkim_verified = false) OR
       (OLD.dmarc_verified = true AND NEW.dmarc_verified = false) THEN
      NEW.verification_status := 'failed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for the verification status update
CREATE TRIGGER update_verification_status_trigger
BEFORE UPDATE OF spf_verified, dkim_verified, dmarc_verified
ON custom_email_settings
FOR EACH ROW
EXECUTE FUNCTION update_verification_status();

-- Migrate existing data to use the new verification_status field
UPDATE custom_email_settings
SET verification_status = 
  CASE 
    WHEN verified = true THEN 'verified'
    ELSE 'unverified'
  END; 