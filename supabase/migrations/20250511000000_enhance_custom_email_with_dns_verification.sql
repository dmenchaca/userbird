/*
  # Enhance Custom Email Configuration with DNS Verification

  1. Updates to custom_email_settings table:
    - Add `domain` - extracted domain from custom_email
    - Add `local_part` - extracted username part from custom_email
    - Add `forwarding_address` - the generated email on userbird-mail.com
    - Add fields for DNS verification status

  2. New Table:
    - `dns_verification_records`
      - Track specific DNS records needed for verification
      - Store record type, name, value, and verification status
*/

-- Extract domain & local part from custom_email
ALTER TABLE custom_email_settings 
ADD COLUMN domain text GENERATED ALWAYS AS (
  split_part(custom_email, '@', 2)
) STORED;

ALTER TABLE custom_email_settings 
ADD COLUMN local_part text GENERATED ALWAYS AS (
  split_part(custom_email, '@', 1)
) STORED;

-- Add forwarding address as a regular column (not generated)
ALTER TABLE custom_email_settings
ADD COLUMN forwarding_address text;

-- Create function and trigger to set forwarding_address
CREATE OR REPLACE FUNCTION update_forwarding_address()
RETURNS TRIGGER AS $$
BEGIN
  NEW.forwarding_address = NEW.local_part || '@' || NEW.domain || '.userbird-mail.com';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_forwarding_address
BEFORE INSERT OR UPDATE OF custom_email, local_part, domain
ON custom_email_settings
FOR EACH ROW
EXECUTE FUNCTION update_forwarding_address();

-- Add DNS verification status fields
ALTER TABLE custom_email_settings
ADD COLUMN spf_verified boolean DEFAULT false,
ADD COLUMN dkim_verified boolean DEFAULT false,
ADD COLUMN dmarc_verified boolean DEFAULT false;

-- Create DNS verification records table
CREATE TABLE dns_verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_email_setting_id uuid REFERENCES custom_email_settings(id) ON DELETE CASCADE,
  record_type text NOT NULL, -- 'TXT', 'CNAME', etc.
  record_name text NOT NULL, -- The DNS record name/key
  record_value text NOT NULL, -- The value to be set
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_dns_verification_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dns_verification_records_timestamp
BEFORE UPDATE ON dns_verification_records
FOR EACH ROW
EXECUTE FUNCTION update_dns_verification_records_updated_at();

-- Enable RLS on new table
ALTER TABLE dns_verification_records ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Users can manage their DNS verification records"
ON dns_verification_records
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM custom_email_settings
    JOIN forms ON forms.id = custom_email_settings.form_id
    WHERE custom_email_settings.id = dns_verification_records.custom_email_setting_id
    AND forms.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM custom_email_settings
    JOIN forms ON forms.id = custom_email_settings.form_id
    WHERE custom_email_settings.id = dns_verification_records.custom_email_setting_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_dns_verification_records_setting_id ON dns_verification_records(custom_email_setting_id);

-- Update existing records to set forwarding_address
UPDATE custom_email_settings
SET forwarding_address = local_part || '@' || domain || '.userbird-mail.com'; 