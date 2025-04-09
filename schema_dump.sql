

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."feedback_status_enum" AS ENUM (
    'open',
    'closed'
);


ALTER TYPE "public"."feedback_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."sender_type_enum" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."sender_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_notification_settings"("form_id_param" "text") RETURNS TABLE("email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT ns.email 
  FROM notification_settings ns
  WHERE ns.form_id = form_id_param 
    AND ns.enabled = true;
END;
$$;


ALTER FUNCTION "public"."check_notification_settings"("form_id_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_temp_email_sender"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM temp_email_sender
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cleanup_temp_email_sender"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_form_feedback"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM feedback WHERE form_id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_form_feedback"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_random_string"("length" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}';
  result text := '';
  i integer := 0;
BEGIN
  IF length < 0 THEN
    RAISE EXCEPTION 'Length must be positive';
  END IF;
  FOR i IN 1..length LOOP
    result := result || chars[1+random()*(array_length(chars, 1)-1)];
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_random_string"("length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ticket_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Get the next ticket number for this form_id
  SELECT COALESCE(MAX(ticket_number) + 1, 1)
  INTO NEW.ticket_number
  FROM feedback
  WHERE form_id = NEW.form_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_accessible_form_ids"() RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Return owned forms
    RETURN QUERY SELECT id FROM forms WHERE owner_id = auth.uid();
    -- Return collaborated forms
    RETURN QUERY SELECT form_id FROM form_collaborators WHERE user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."get_accessible_form_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_form_sender_email"("form_id" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  custom_email text;
  default_email text;
BEGIN
  -- First check for verified custom email
  SELECT ces.custom_email INTO custom_email
  FROM custom_email_settings ces
  WHERE ces.form_id = $1 AND ces.verified = true
  LIMIT 1;
  
  IF custom_email IS NOT NULL THEN
    RETURN custom_email;
  END IF;
  
  -- If no custom email, use the form's default email
  SELECT f.default_email INTO default_email
  FROM forms f
  WHERE f.id = $1
  LIMIT 1;
  
  IF default_email IS NOT NULL THEN
    RETURN default_email;
  END IF;
  
  -- Fallback to system default
  RETURN 'notifications@userbird.co';
END;
$_$;


ALTER FUNCTION "public"."get_form_sender_email"("form_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_collaboration_forms"("user_id_param" "uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  form_ids TEXT[];
BEGIN
  -- Query the form_collaborators table directly, bypassing RLS
  SELECT COALESCE(ARRAY_AGG(form_id), ARRAY[]::TEXT[])
  INTO form_ids
  FROM form_collaborators
  WHERE user_id = user_id_param
    AND invitation_accepted = true;
  
  -- For debugging
  RAISE LOG 'get_user_collaboration_forms called with user_id: % returning forms: %', user_id_param, form_ids;
  
  RETURN form_ids;
END;
$$;


ALTER FUNCTION "public"."get_user_collaboration_forms"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email_param" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Query from auth.users directly
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = email_param
  LIMIT 1;
  
  RETURN user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_id_by_email"("email_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_form"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Insert notification setting for the owner if table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'notification_settings'
    ) THEN
        INSERT INTO notification_settings (form_id, email)
        SELECT NEW.id, email
        FROM auth.users
        WHERE id = NEW.owner_id
        AND email IS NOT NULL;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_form"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_registration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Look for any pending invitations matching this email
  UPDATE form_collaborators
  SET 
    user_id = NEW.id,
    invitation_accepted = true,
    updated_at = now()
  WHERE 
    invitation_email = NEW.email
    AND (user_id IS NULL OR invitation_accepted = false);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_registration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_url"("url" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  -- Allow localhost with optional port
  IF url ~ '^localhost(:[0-9]+)?$' THEN
    RETURN true;
  END IF;
  
  -- Allow standard domains with optional port
  RETURN url ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})(:[0-9]+)?$';
END;
$_$;


ALTER FUNCTION "public"."is_valid_url"("url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_feedback_images"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_bucket CONSTANT text := 'feedback_images';
    new_bucket CONSTANT text := 'feedback-images';
    obj RECORD;
BEGIN
    -- Create new bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    VALUES (new_bucket, new_bucket, true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    -- Copy images from old bucket to new bucket
    FOR obj IN 
        SELECT * FROM storage.objects 
        WHERE bucket_id = old_bucket
    LOOP
        -- Copy file to new bucket
        INSERT INTO storage.objects (
            bucket_id,
            name,
            owner,
            created_at,
            updated_at,
            last_accessed_at,
            metadata,
            path_tokens,
            version
        )
        VALUES (
            new_bucket,
            obj.name,
            obj.owner,
            obj.created_at,
            obj.updated_at,
            obj.last_accessed_at,
            obj.metadata,
            obj.path_tokens,
            obj.version
        )
        ON CONFLICT (bucket_id, name) DO NOTHING;
        
        -- Update feedback records to use new bucket URL
        UPDATE feedback
        SET image_url = REPLACE(image_url, old_bucket, new_bucket)
        WHERE image_url LIKE '%' || old_bucket || '%';
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."migrate_feedback_images"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_custom_email_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_custom_email_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dns_verification_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dns_verification_records_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_verification_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_verification_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_webhook_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_webhook_settings_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."custom_email_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "text",
    "custom_email" "text" NOT NULL,
    "verified" boolean DEFAULT false,
    "verification_token" "text",
    "verification_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "domain" "text" GENERATED ALWAYS AS ("split_part"("custom_email", '@'::"text", 2)) STORED,
    "local_part" "text" GENERATED ALWAYS AS ("split_part"("custom_email", '@'::"text", 1)) STORED,
    "forwarding_address" "text",
    "spf_verified" boolean DEFAULT false,
    "dkim_verified" boolean DEFAULT false,
    "dmarc_verified" boolean DEFAULT false,
    "verification_status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "last_verification_attempt" timestamp with time zone,
    "verification_messages" "text"[],
    CONSTRAINT "custom_email_settings_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'failed'::"text"]))),
    CONSTRAINT "valid_custom_email" CHECK (("custom_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))
);


ALTER TABLE "public"."custom_email_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dns_verification_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "custom_email_setting_id" "uuid",
    "record_type" "text" NOT NULL,
    "record_name" "text" NOT NULL,
    "record_value" "text" NOT NULL,
    "verified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dkim_selector" "text",
    "dkim_private_key" "text",
    "last_check_time" timestamp with time zone,
    "failure_reason" "text"
);


ALTER TABLE "public"."dns_verification_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "text",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "operating_system" "text" NOT NULL,
    "screen_category" "text" NOT NULL,
    "user_id" "text",
    "user_email" "text",
    "user_name" "text",
    "image_url" "text",
    "image_name" "text",
    "image_size" integer,
    "url_path" "text",
    "status" "public"."feedback_status_enum" DEFAULT 'open'::"public"."feedback_status_enum" NOT NULL,
    "tag_id" "uuid",
    "ticket_number" integer,
    CONSTRAINT "valid_email" CHECK ((("user_email" IS NULL) OR ("user_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))),
    CONSTRAINT "valid_image_extension" CHECK ((("image_name" IS NULL) OR ("image_name" ~* '.*\.(jpg|jpeg|png)$'::"text"))),
    CONSTRAINT "valid_image_size" CHECK ((("image_size" IS NULL) OR ("image_size" <= 5242880)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback" IS 'Fixed infinite recursion in RLS policies by rebuilding all policies from scratch with non-recursive definitions.';



CREATE TABLE IF NOT EXISTS "public"."feedback_attachments" (
    "id" "uuid" NOT NULL,
    "reply_id" "uuid",
    "filename" "text" NOT NULL,
    "content_id" "text",
    "content_type" "text" NOT NULL,
    "url" "text" NOT NULL,
    "is_inline" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."feedback_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_attachments" IS 'Stores attachment metadata for email replies, including inline images referenced in HTML content';



CREATE TABLE IF NOT EXISTS "public"."feedback_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid",
    "sender_type" "public"."sender_type_enum" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "message_id" "text",
    "in_reply_to" "text",
    "html_content" "text"
);


ALTER TABLE "public"."feedback_replies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."feedback_replies"."html_content" IS 'Sanitized HTML content of the reply, including links and formatting';



CREATE TABLE IF NOT EXISTS "public"."feedback_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "text",
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#0EA5E9'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_favorite" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."feedback_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_tags" IS 'Tags can be managed by owners and viewed by collaborators.';



CREATE TABLE IF NOT EXISTS "public"."form_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "text",
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "invitation_email" "text",
    "invitation_accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "form_collaborators_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'agent'::"text"])))
);


ALTER TABLE "public"."form_collaborators" OWNER TO "postgres";


COMMENT ON TABLE "public"."form_collaborators" IS 'Fixed infinite recursion with minimal, non-recursive policies';



CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "button_color" "text" DEFAULT '#1f2937'::"text",
    "support_text" "text",
    "owner_id" "uuid",
    "keyboard_shortcut" "text" DEFAULT 'L'::"text",
    "sound_enabled" boolean DEFAULT true,
    "show_gif_on_success" boolean DEFAULT true,
    "gif_urls" "text"[] DEFAULT ARRAY['https://media1.tenor.com/m/TqHquUQoqu8AAAAd/you%27re-a-lifesaver-dove.gif'::"text", 'https://media1.tenor.com/m/4PLfYPBvjhQAAAAd/tannerparty-tanner.gif'::"text", 'https://media1.tenor.com/m/lRY5I7kwR08AAAAd/brooklyn-nine-nine-amy-and-rosa.gif'::"text", 'https://media1.tenor.com/m/9LbEpuHBPScAAAAd/brooklyn-nine-nine-amy-and-rosa.gif'::"text", 'https://media1.tenor.com/m/mnx8ECSie6EAAAAd/sheldon-cooper-big-bang-theory.gif'::"text"],
    "remove_branding" boolean DEFAULT false,
    "icon_url" "text",
    "default_sender_name" "text",
    "default_email" "text" GENERATED ALWAYS AS (("id" || '@userbird-mail.com'::"text")) STORED,
    CONSTRAINT "forms_button_color_check" CHECK (("button_color" ~ '^#[0-9a-fA-F]{6}$'::"text"))
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


COMMENT ON TABLE "public"."forms" IS 'Fixed infinite recursion with minimal, non-recursive policies';



COMMENT ON COLUMN "public"."forms"."remove_branding" IS 'Controls whether to show "We run on Userbird" branding in the widget';



COMMENT ON COLUMN "public"."forms"."icon_url" IS 'URL to the form icon, usually scraped from target website favicon';



CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "text",
    "email" "text" NOT NULL,
    "enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notification_attributes" "text"[] DEFAULT ARRAY['message'::"text"],
    CONSTRAINT "valid_email" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "valid_notification_attributes" CHECK ((("array_length"("notification_attributes", 1) > 0) AND ('message'::"text" = ANY ("notification_attributes")) AND ("notification_attributes" <@ ARRAY['message'::"text", 'url_path'::"text", 'user_id'::"text", 'user_email'::"text", 'user_name'::"text", 'operating_system'::"text", 'screen_category'::"text", 'image_url'::"text", 'image_name'::"text", 'created_at'::"text"])))
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_settings" IS 'Fixed infinite recursion in RLS policies by rebuilding all policies from scratch with non-recursive definitions.';



CREATE TABLE IF NOT EXISTS "public"."temp_email_sender" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_id" "uuid" NOT NULL,
    "sender_email" "text" NOT NULL,
    "sender_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed" boolean DEFAULT false
);


ALTER TABLE "public"."temp_email_sender" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_settings" (
    "id" "text" DEFAULT ('whk_'::"text" || "public"."generate_random_string"(16)) NOT NULL,
    "form_id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_delivery_at" timestamp with time zone,
    "last_delivery_status" "text",
    "last_delivery_error" "text",
    "signing_secret" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL
);


ALTER TABLE "public"."webhook_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."custom_email_settings"
    ADD CONSTRAINT "custom_email_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dns_verification_records"
    ADD CONSTRAINT "dns_verification_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_attachments"
    ADD CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_tags"
    ADD CONSTRAINT "feedback_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_collaborators"
    ADD CONSTRAINT "form_collaborators_form_id_user_id_key" UNIQUE ("form_id", "user_id");



ALTER TABLE ONLY "public"."form_collaborators"
    ADD CONSTRAINT "form_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."temp_email_sender"
    ADD CONSTRAINT "temp_email_sender_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_settings"
    ADD CONSTRAINT "webhook_settings_form_id_key" UNIQUE ("form_id");



ALTER TABLE ONLY "public"."webhook_settings"
    ADD CONSTRAINT "webhook_settings_pkey" PRIMARY KEY ("id");



CREATE INDEX "feedback_attachments_content_id_idx" ON "public"."feedback_attachments" USING "btree" ("content_id");



CREATE INDEX "feedback_attachments_reply_id_idx" ON "public"."feedback_attachments" USING "btree" ("reply_id");



CREATE UNIQUE INDEX "feedback_tags_global_name_idx" ON "public"."feedback_tags" USING "btree" ("name") WHERE ("form_id" IS NULL);



CREATE UNIQUE INDEX "feedback_tags_name_form_idx" ON "public"."feedback_tags" USING "btree" ("name", "form_id") WHERE ("form_id" IS NOT NULL);



CREATE INDEX "idx_custom_email_settings_form_id" ON "public"."custom_email_settings" USING "btree" ("form_id");



CREATE INDEX "idx_dns_verification_records_setting_id" ON "public"."dns_verification_records" USING "btree" ("custom_email_setting_id");



CREATE INDEX "idx_feedback_created_at" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_form_id" ON "public"."feedback" USING "btree" ("form_id");



CREATE INDEX "idx_feedback_replies_feedback_id" ON "public"."feedback_replies" USING "btree" ("feedback_id");



CREATE INDEX "idx_feedback_replies_in_reply_to" ON "public"."feedback_replies" USING "btree" ("in_reply_to");



CREATE INDEX "idx_feedback_replies_message_id" ON "public"."feedback_replies" USING "btree" ("message_id");



CREATE INDEX "idx_feedback_status" ON "public"."feedback" USING "btree" ("status");



CREATE INDEX "idx_feedback_tag_id" ON "public"."feedback" USING "btree" ("tag_id");



CREATE INDEX "idx_feedback_tags_favorite" ON "public"."feedback_tags" USING "btree" ("is_favorite");



CREATE INDEX "idx_feedback_tags_form_id" ON "public"."feedback_tags" USING "btree" ("form_id");



CREATE INDEX "idx_feedback_ticket_number" ON "public"."feedback" USING "btree" ("form_id", "ticket_number");



CREATE INDEX "idx_form_collaborators_form_id" ON "public"."form_collaborators" USING "btree" ("form_id");



CREATE INDEX "idx_form_collaborators_user_id" ON "public"."form_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_forms_keyboard_shortcut" ON "public"."forms" USING "btree" ("keyboard_shortcut") WHERE ("keyboard_shortcut" IS NOT NULL);



CREATE INDEX "idx_notification_settings_form_id" ON "public"."notification_settings" USING "btree" ("form_id");



CREATE INDEX "idx_temp_email_sender_feedback_id" ON "public"."temp_email_sender" USING "btree" ("feedback_id");



CREATE INDEX "idx_verification_status" ON "public"."custom_email_settings" USING "btree" ("verification_status");



CREATE OR REPLACE TRIGGER "cascade_delete_feedback" BEFORE DELETE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."delete_form_feedback"();



CREATE OR REPLACE TRIGGER "cleanup_temp_email_sender_trigger" AFTER INSERT ON "public"."temp_email_sender" FOR EACH STATEMENT EXECUTE FUNCTION "public"."cleanup_temp_email_sender"();



CREATE OR REPLACE TRIGGER "on_form_created" AFTER INSERT ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_form"();



CREATE OR REPLACE TRIGGER "set_ticket_number" BEFORE INSERT ON "public"."feedback" FOR EACH ROW EXECUTE FUNCTION "public"."generate_ticket_number"();



CREATE OR REPLACE TRIGGER "update_custom_email_settings_timestamp" BEFORE UPDATE ON "public"."custom_email_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_custom_email_settings_updated_at"();



CREATE OR REPLACE TRIGGER "update_dns_verification_records_timestamp" BEFORE UPDATE ON "public"."dns_verification_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_dns_verification_records_updated_at"();



CREATE OR REPLACE TRIGGER "update_feedback_replies_updated_at" BEFORE UPDATE ON "public"."feedback_replies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_verification_status_trigger" BEFORE UPDATE OF "spf_verified", "dkim_verified", "dmarc_verified" ON "public"."custom_email_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_verification_status"();



CREATE OR REPLACE TRIGGER "update_webhook_settings_updated_at" BEFORE UPDATE ON "public"."webhook_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_webhook_settings_updated_at"();



ALTER TABLE ONLY "public"."custom_email_settings"
    ADD CONSTRAINT "custom_email_settings_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dns_verification_records"
    ADD CONSTRAINT "dns_verification_records_custom_email_setting_id_fkey" FOREIGN KEY ("custom_email_setting_id") REFERENCES "public"."custom_email_settings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_attachments"
    ADD CONSTRAINT "feedback_attachments_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "public"."feedback_replies"("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_replies"
    ADD CONSTRAINT "feedback_replies_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."feedback_tags"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_tags"
    ADD CONSTRAINT "feedback_tags_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_collaborators"
    ADD CONSTRAINT "form_collaborators_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."form_collaborators"
    ADD CONSTRAINT "form_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."form_collaborators"
    ADD CONSTRAINT "form_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."temp_email_sender"
    ADD CONSTRAINT "temp_email_sender_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_settings"
    ADD CONSTRAINT "webhook_settings_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;



CREATE POLICY "Admin collaborators can delete existing collaborators" ON "public"."form_collaborators" FOR DELETE TO "authenticated" USING (("form_id" IN ( SELECT "form_collaborators_1"."form_id"
   FROM "public"."form_collaborators" "form_collaborators_1"
  WHERE (("form_collaborators_1"."user_id" = "auth"."uid"()) AND ("form_collaborators_1"."role" = 'admin'::"text")))));



CREATE POLICY "Admin collaborators can insert new collaborators" ON "public"."form_collaborators" FOR INSERT TO "authenticated" WITH CHECK (("form_id" IN ( SELECT "form_collaborators_1"."form_id"
   FROM "public"."form_collaborators" "form_collaborators_1"
  WHERE (("form_collaborators_1"."user_id" = "auth"."uid"()) AND ("form_collaborators_1"."role" = 'admin'::"text")))));



CREATE POLICY "Admin collaborators can select existing collaborators" ON "public"."form_collaborators" FOR SELECT TO "authenticated" USING (("form_id" IN ( SELECT "form_collaborators_1"."form_id"
   FROM "public"."form_collaborators" "form_collaborators_1"
  WHERE (("form_collaborators_1"."user_id" = "auth"."uid"()) AND ("form_collaborators_1"."role" = 'admin'::"text")))));



CREATE POLICY "Admin collaborators can update existing collaborators" ON "public"."form_collaborators" FOR UPDATE TO "authenticated" USING (("form_id" IN ( SELECT "form_collaborators_1"."form_id"
   FROM "public"."form_collaborators" "form_collaborators_1"
  WHERE (("form_collaborators_1"."user_id" = "auth"."uid"()) AND ("form_collaborators_1"."role" = 'admin'::"text"))))) WITH CHECK (("form_id" IN ( SELECT "form_collaborators_1"."form_id"
   FROM "public"."form_collaborators" "form_collaborators_1"
  WHERE (("form_collaborators_1"."user_id" = "auth"."uid"()) AND ("form_collaborators_1"."role" = 'admin'::"text")))));



CREATE POLICY "Authenticated can manage feedback" ON "public"."feedback" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage tags" ON "public"."feedback_tags" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can reply" ON "public"."feedback_replies" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can view email settings" ON "public"."custom_email_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view attachments" ON "public"."feedback_attachments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Collaborators can view attachments" ON "public"."feedback_attachments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."feedback_replies" "fr"
     JOIN "public"."feedback" "f" ON (("f"."id" = "fr"."feedback_id")))
     JOIN "public"."form_collaborators" "fc" ON (("fc"."form_id" = "f"."form_id")))
  WHERE (("fr"."id" = "feedback_attachments"."reply_id") AND ("fc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Form owners can manage attachments" ON "public"."feedback_attachments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."feedback_replies" "fr"
     JOIN "public"."feedback" "f" ON (("f"."id" = "fr"."feedback_id")))
     JOIN "public"."forms" ON (("forms"."id" = "f"."form_id")))
  WHERE (("fr"."id" = "feedback_attachments"."reply_id") AND ("forms"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."feedback_replies" "fr"
     JOIN "public"."feedback" "f" ON (("f"."id" = "fr"."feedback_id")))
     JOIN "public"."forms" ON (("forms"."id" = "f"."form_id")))
  WHERE (("fr"."id" = "feedback_attachments"."reply_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners can manage collaborators" ON "public"."form_collaborators" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_collaborators"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners can manage email settings" ON "public"."custom_email_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "custom_email_settings"."form_id") AND ("forms"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "custom_email_settings"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners can manage existing collaborators" ON "public"."form_collaborators" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_collaborators"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."form_collaborators" "existing_collab"
  WHERE (("existing_collab"."form_id" = "form_collaborators"."form_id") AND ("existing_collab"."user_id" = "auth"."uid"()) AND ("existing_collab"."role" = 'admin'::"text"))))));



CREATE POLICY "Form owners can manage tags" ON "public"."feedback_tags" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "feedback_tags"."form_id") AND ("forms"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "feedback_tags"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners only access notification_settings" ON "public"."notification_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "notification_settings"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners only access webhook_settings" ON "public"."webhook_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "webhook_settings"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Form owners only notification" ON "public"."notification_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "notification_settings"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owner forms access" ON "public"."forms" TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Public can read feedback" ON "public"."feedback" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can submit attachments" ON "public"."feedback_attachments" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can submit feedback" ON "public"."feedback" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can view email settings" ON "public"."custom_email_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can view replies" ON "public"."feedback_replies" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can view tags" ON "public"."feedback_tags" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public collaborator access" ON "public"."form_collaborators" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public forms access" ON "public"."forms" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Self collaborator access" ON "public"."form_collaborators" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can accept invitations via email" ON "public"."form_collaborators" FOR UPDATE TO "authenticated" USING ((("invitation_email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text") AND ("user_id" IS NULL))) WITH CHECK ((("user_id" = "auth"."uid"()) AND ("invitation_accepted" = true)));



CREATE POLICY "Users can invite collaborators to forms they own or admin" ON "public"."form_collaborators" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."forms"
  WHERE (("forms"."id" = "form_collaborators"."form_id") AND ("forms"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."form_collaborators" "existing_collab"
  WHERE (("existing_collab"."form_id" = "form_collaborators"."form_id") AND ("existing_collab"."user_id" = "auth"."uid"()) AND ("existing_collab"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can view forms they are invited to" ON "public"."form_collaborators" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."custom_email_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dns_verification_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."temp_email_sender" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_settings" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_notification_settings"("form_id_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_notification_settings"("form_id_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_notification_settings"("form_id_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_temp_email_sender"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_temp_email_sender"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_temp_email_sender"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_form_feedback"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_form_feedback"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_form_feedback"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_random_string"("length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_random_string"("length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_random_string"("length" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_accessible_form_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_accessible_form_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_accessible_form_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_form_sender_email"("form_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_form_sender_email"("form_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_form_sender_email"("form_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_collaboration_forms"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_collaboration_forms"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_collaboration_forms"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("email_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_form"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_form"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_form"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_registration"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_url"("url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_feedback_images"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_feedback_images"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_feedback_images"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_custom_email_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_custom_email_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_custom_email_settings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dns_verification_records_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dns_verification_records_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dns_verification_records_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_verification_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_verification_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_verification_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_webhook_settings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_webhook_settings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_webhook_settings_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."custom_email_settings" TO "anon";
GRANT ALL ON TABLE "public"."custom_email_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_email_settings" TO "service_role";



GRANT ALL ON TABLE "public"."dns_verification_records" TO "anon";
GRANT ALL ON TABLE "public"."dns_verification_records" TO "authenticated";
GRANT ALL ON TABLE "public"."dns_verification_records" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."feedback" TO PUBLIC;



GRANT ALL ON TABLE "public"."feedback_attachments" TO "anon";
GRANT ALL ON TABLE "public"."feedback_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_replies" TO "anon";
GRANT ALL ON TABLE "public"."feedback_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_replies" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_tags" TO "anon";
GRANT ALL ON TABLE "public"."feedback_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_tags" TO "service_role";



GRANT ALL ON TABLE "public"."form_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."form_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."form_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "anon";
GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."temp_email_sender" TO "anon";
GRANT ALL ON TABLE "public"."temp_email_sender" TO "authenticated";
GRANT ALL ON TABLE "public"."temp_email_sender" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_settings" TO "anon";
GRANT ALL ON TABLE "public"."webhook_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
