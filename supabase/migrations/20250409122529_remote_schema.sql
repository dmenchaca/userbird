drop trigger if exists "on_form_created_tracking" on "public"."forms";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'custom_email_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage their form custom email settings" ON public.custom_email_settings$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'dns_verification_records'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage their DNS verification records" ON public.dns_verification_records$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow collaborators to view form feedback" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow feedback to use appropriate tags" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow owners and admin collaborators to delete feedback" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public feedback status update" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow reading feedback by form ID" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow users to update feedback for forms they own or collaborat" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Authenticated users can read all feedback for forms they own" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Collaborators can update feedback" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Public feedback reading" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Public feedback submission" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to feedback" ON public.feedback$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can update their own feedback status and tag" ON public.feedback$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public feedback reply reading" ON public.feedback_replies$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public feedback reply submission" ON public.feedback_replies$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_tags'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public reading of feedback tags" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Authenticated users can read all feedback tags for forms they o" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to feedback_tags" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage form tags" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage tags for forms they own or are admins of" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can view global and form tags" ON public.feedback_tags$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can view tags for forms they own or collaborate on" ON public.feedback_tags$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'form_collaborators'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to form_collaborators" ON public.form_collaborators$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'forms'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow authenticated users to create forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow direct owner_id queries" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public form deletion" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public to read form settings" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow reading forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Authenticated users can read all forms they own" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can view forms they own" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Validate form URL on insert" ON public.forms$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'notification_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Service role can read notification settings" ON public.notification_settings$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to notification_settings" ON public.notification_settings$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'webhook_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Admin collaborators can manage webhook settings" ON public.webhook_settings$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Agent collaborators can view webhook settings" ON public.webhook_settings$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage webhook settings for their forms" ON public.webhook_settings$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_notification_attributes' 
    AND conrelid = 'public.notification_settings'::regclass
  ) THEN
    ALTER TABLE "public"."notification_settings" DROP CONSTRAINT "valid_notification_attributes";
  END IF;
END $$;

drop function if exists "public"."handle_form_created"();

drop function if exists "public"."user_has_form_access"(form_id_param text, user_id_param uuid);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_notification_settings(form_id_param text)
 RETURNS TABLE(email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT ns.email 
  FROM notification_settings ns
  WHERE ns.form_id = form_id_param 
    AND ns.enabled = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_temp_email_sender()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM temp_email_sender
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_form_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM feedback WHERE form_id = OLD.id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_random_string(length integer)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_accessible_form_ids()
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Return owned forms
    RETURN QUERY SELECT id FROM forms WHERE owner_id = auth.uid();
    -- Return collaborated forms
    RETURN QUERY SELECT form_id FROM form_collaborators WHERE user_id = auth.uid();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_feedback_images()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_webhook_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    grant delete on table "public"."feedback_attachments" to "anon";
    grant insert on table "public"."feedback_attachments" to "anon";
    grant references on table "public"."feedback_attachments" to "anon";
    grant select on table "public"."feedback_attachments" to "anon";
    grant trigger on table "public"."feedback_attachments" to "anon";
    grant truncate on table "public"."feedback_attachments" to "anon";
    grant update on table "public"."feedback_attachments" to "anon";
    grant delete on table "public"."feedback_attachments" to "authenticated";
    grant insert on table "public"."feedback_attachments" to "authenticated";
    grant references on table "public"."feedback_attachments" to "authenticated";
    grant select on table "public"."feedback_attachments" to "authenticated";
    grant trigger on table "public"."feedback_attachments" to "authenticated";
    grant truncate on table "public"."feedback_attachments" to "authenticated";
    grant update on table "public"."feedback_attachments" to "authenticated";
    grant delete on table "public"."feedback_attachments" to "service_role";
    grant insert on table "public"."feedback_attachments" to "service_role";
    grant references on table "public"."feedback_attachments" to "service_role";
    grant select on table "public"."feedback_attachments" to "service_role";
    grant trigger on table "public"."feedback_attachments" to "service_role";
    grant truncate on table "public"."feedback_attachments" to "service_role";
    grant update on table "public"."feedback_attachments" to "service_role";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'temp_email_sender'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE TABLE "public"."temp_email_sender" (
      "id" uuid not null default gen_random_uuid(),
      "feedback_id" uuid not null,
      "sender_email" text not null,
      "sender_name" text,
      "created_at" timestamp with time zone default now(),
      "processed" boolean default false
    );

    ALTER TABLE "public"."temp_email_sender" ENABLE ROW LEVEL SECURITY;
    
    -- Create trigger after table exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'cleanup_temp_email_sender_trigger'
      AND tgrelid = 'public.temp_email_sender'::regclass
    ) THEN
      CREATE TRIGGER cleanup_temp_email_sender_trigger AFTER INSERT ON public.temp_email_sender FOR EACH STATEMENT EXECUTE FUNCTION cleanup_temp_email_sender();
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'custom_email_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    create policy "Authenticated can view email settings"
    on "public"."custom_email_settings"
    as permissive
    for select
    to authenticated
    using (true);

    create policy "Form owners can manage email settings"
    on "public"."custom_email_settings"
    as permissive
    for all
    to authenticated
    using ((EXISTS ( SELECT 1
       FROM forms
      WHERE ((forms.id = custom_email_settings.form_id) AND (forms.owner_id = auth.uid())))));

    create policy "Public can view email settings"
    on "public"."custom_email_settings"
    as permissive
    for select
    to anon
    using (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'dns_verification_records'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    create policy "Form owners can manage DNS verification"
    on "public"."dns_verification_records"
    as permissive
    for all
    to authenticated
    using ((EXISTS ( SELECT 1
       FROM forms
      WHERE ((forms.id = dns_verification_records.form_id) AND (forms.owner_id = auth.uid())))));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    create policy "Authenticated can view attachments"
    on "public"."feedback_attachments"
    as permissive
    for select
    to authenticated
    using (true);

    create policy "Public can view attachments"
    on "public"."feedback_attachments"
    as permissive
    for select
    to anon
    using (true);

    create policy "Public can submit attachments"
    on "public"."feedback_attachments"
    as permissive
    for insert
    to anon
    with check (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    create policy "Authenticated can reply"
    on "public"."feedback_replies"
    as permissive
    for all
    to authenticated
    using (true)
    with check (true);

    create policy "Public can view replies"
    on "public"."feedback_replies"
    as permissive
    for select
    to anon
    using (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_tags'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    create policy "Authenticated can manage tags"
    on "public"."feedback_tags"
    as permissive
    for all
    to authenticated
    using (true)
    with check (true);

    create policy "Form owners can manage tags"
    on "public"."feedback_tags"
    as permissive
    for all
    to authenticated
    using ((EXISTS ( SELECT 1
       FROM forms
      WHERE ((forms.id = feedback_tags.form_id) AND (forms.owner_id = auth.uid())))))
    with check ((EXISTS ( SELECT 1
       FROM forms
      WHERE ((forms.id = feedback_tags.form_id) AND (forms.owner_id = auth.uid())))));

    create policy "Public can view tags"
    on "public"."feedback_tags"
    as permissive
    for select
    to anon
    using (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'form_collaborators'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to form_collaborators" ON public.form_collaborators$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'forms'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow authenticated users to create forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow direct owner_id queries" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public form deletion" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow public to read form settings" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Allow reading forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Authenticated users can read all forms they own" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Unrestricted access to forms" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can view forms they own" ON public.forms$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Validate form URL on insert" ON public.forms$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'notification_settings'
    AND relnamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_notification_attributes'
    AND conrelid = 'public.notification_settings'::regclass
  ) THEN
    ALTER TABLE "public"."notification_settings" 
      ADD CONSTRAINT "valid_notification_attributes" 
      CHECK (((array_length(notification_attributes, 1) > 0) AND ('message'::text = ANY (notification_attributes)) AND (notification_attributes <@ ARRAY['message'::text, 'url_path'::text, 'user_id'::text, 'user_email'::text, 'user_name'::text, 'operating_system'::text, 'screen_category'::text, 'image_url'::text, 'image_name'::text, 'created_at'::text]))) not valid;
    
    ALTER TABLE "public"."notification_settings" 
      VALIDATE CONSTRAINT "valid_notification_attributes";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'webhook_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $policy$DROP POLICY IF EXISTS "Admin collaborators can manage webhook settings" ON public.webhook_settings$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Agent collaborators can view webhook settings" ON public.webhook_settings$policy$;
    EXECUTE $policy$DROP POLICY IF EXISTS "Users can manage webhook settings for their forms" ON public.webhook_settings$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS feedback_attachments_content_id_idx ON public.feedback_attachments USING btree (content_id);
    CREATE UNIQUE INDEX IF NOT EXISTS feedback_attachments_pkey ON public.feedback_attachments USING btree (id);
    CREATE INDEX IF NOT EXISTS feedback_attachments_reply_id_idx ON public.feedback_attachments USING btree (reply_id);
    
    ALTER TABLE "public"."feedback_attachments" 
      ADD CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY USING INDEX "feedback_attachments_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_replies_in_reply_to ON public.feedback_replies USING btree (in_reply_to);
    CREATE INDEX IF NOT EXISTS idx_feedback_replies_message_id ON public.feedback_replies USING btree (message_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.feedback'::regclass
    AND attname = 'tag_id'
    AND NOT attisdropped
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_tag_id ON public.feedback USING btree (tag_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_tags'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_tags_form_id ON public.feedback_tags USING btree (form_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'forms'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_forms_keyboard_shortcut ON public.forms USING btree (keyboard_shortcut) WHERE (keyboard_shortcut IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'temp_email_sender'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_temp_email_sender_feedback_id ON public.temp_email_sender USING btree (feedback_id);
    CREATE UNIQUE INDEX IF NOT EXISTS temp_email_sender_pkey ON public.temp_email_sender USING btree (id);
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'temp_email_sender_pkey'
      AND conrelid = 'public.temp_email_sender'::regclass
    ) THEN
      ALTER TABLE "public"."temp_email_sender" 
        ADD CONSTRAINT "temp_email_sender_pkey" PRIMARY KEY USING INDEX "temp_email_sender_pkey";
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."feedback_attachments" 
      ADD CONSTRAINT "feedback_attachments_reply_id_fkey" 
      FOREIGN KEY (reply_id) REFERENCES feedback_replies(id) not valid;
    
    ALTER TABLE "public"."feedback_attachments" 
      VALIDATE CONSTRAINT "feedback_attachments_reply_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'temp_email_sender'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback'
    AND relnamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'temp_email_sender_feedback_id_fkey'
    AND conrelid = 'public.temp_email_sender'::regclass
  ) THEN
    ALTER TABLE "public"."temp_email_sender" 
      ADD CONSTRAINT "temp_email_sender_feedback_id_fkey" 
      FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE not valid;
    
    ALTER TABLE "public"."temp_email_sender" 
      VALIDATE CONSTRAINT "temp_email_sender_feedback_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'cascade_delete_feedback'
    AND tgrelid = 'public.forms'::regclass
  ) THEN
    CREATE TRIGGER cascade_delete_feedback BEFORE DELETE ON public.forms FOR EACH ROW EXECUTE FUNCTION delete_form_feedback();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_webhook_settings_updated_at'
    AND tgrelid = 'public.webhook_settings'::regclass
  ) THEN
    CREATE TRIGGER update_webhook_settings_updated_at BEFORE UPDATE ON public.webhook_settings FOR EACH ROW EXECUTE FUNCTION update_webhook_settings_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE TABLE "public"."feedback_attachments" (
      "id" uuid not null,
      "reply_id" uuid,
      "filename" text not null,
      "content_id" text,
      "content_type" text not null,
      "url" text not null,
      "is_inline" boolean default false,
      "created_at" timestamp with time zone default timezone('utc'::text, now())
    );

    ALTER TABLE "public"."feedback_attachments" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."feedback_replies" ADD COLUMN IF NOT EXISTS "html_content" text;
    ALTER TABLE "public"."feedback_replies" ADD COLUMN IF NOT EXISTS "in_reply_to" text;
    ALTER TABLE "public"."feedback_replies" ADD COLUMN IF NOT EXISTS "message_id" text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_tags'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."feedback_tags" ALTER COLUMN "color" SET DEFAULT '#0EA5E9'::text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'forms'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."forms" ADD COLUMN IF NOT EXISTS "icon_url" text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'webhook_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."webhook_settings" ADD COLUMN IF NOT EXISTS "last_delivery_at" timestamp with time zone;
    ALTER TABLE "public"."webhook_settings" ADD COLUMN IF NOT EXISTS "last_delivery_error" text;
    ALTER TABLE "public"."webhook_settings" ADD COLUMN IF NOT EXISTS "last_delivery_status" text;
    ALTER TABLE "public"."webhook_settings" ADD COLUMN IF NOT EXISTS "signing_secret" text DEFAULT encode(gen_random_bytes(32), 'hex'::text);
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "enabled" SET NOT NULL;
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "form_id" SET NOT NULL;
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "id" SET DEFAULT ('whk_'::text || generate_random_string(16));
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "public"."webhook_settings" ALTER COLUMN "url" SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS feedback_attachments_content_id_idx ON public.feedback_attachments USING btree (content_id);
    CREATE UNIQUE INDEX IF NOT EXISTS feedback_attachments_pkey ON public.feedback_attachments USING btree (id);
    CREATE INDEX IF NOT EXISTS feedback_attachments_reply_id_idx ON public.feedback_attachments USING btree (reply_id);
    
    ALTER TABLE "public"."feedback_attachments" 
      ADD CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY USING INDEX "feedback_attachments_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_replies_in_reply_to ON public.feedback_replies USING btree (in_reply_to);
    CREATE INDEX IF NOT EXISTS idx_feedback_replies_message_id ON public.feedback_replies USING btree (message_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.feedback'::regclass
    AND attname = 'tag_id'
    AND NOT attisdropped
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_tag_id ON public.feedback USING btree (tag_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_tags'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_feedback_tags_form_id ON public.feedback_tags USING btree (form_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'forms'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_forms_keyboard_shortcut ON public.forms USING btree (keyboard_shortcut) WHERE (keyboard_shortcut IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'temp_email_sender'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_temp_email_sender_feedback_id ON public.temp_email_sender USING btree (feedback_id);
    CREATE UNIQUE INDEX IF NOT EXISTS temp_email_sender_pkey ON public.temp_email_sender USING btree (id);
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'temp_email_sender_pkey'
      AND conrelid = 'public.temp_email_sender'::regclass
    ) THEN
      ALTER TABLE "public"."temp_email_sender" 
        ADD CONSTRAINT "temp_email_sender_pkey" PRIMARY KEY USING INDEX "temp_email_sender_pkey";
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_attachments'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback_replies'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE "public"."feedback_attachments" 
      ADD CONSTRAINT "feedback_attachments_reply_id_fkey" 
      FOREIGN KEY (reply_id) REFERENCES feedback_replies(id) not valid;
    
    ALTER TABLE "public"."feedback_attachments" 
      VALIDATE CONSTRAINT "feedback_attachments_reply_id_fkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'temp_email_sender'
    AND relnamespace = 'public'::regnamespace
  ) AND EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'feedback'
    AND relnamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'temp_email_sender_feedback_id_fkey'
    AND conrelid = 'public.temp_email_sender'::regclass
  ) THEN
    ALTER TABLE "public"."temp_email_sender" 
      ADD CONSTRAINT "temp_email_sender_feedback_id_fkey" 
      FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE not valid;
    
    ALTER TABLE "public"."temp_email_sender" 
      VALIDATE CONSTRAINT "temp_email_sender_feedback_id_fkey";
  END IF;
END $$;


