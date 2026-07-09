


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_season_id uuid;
  v_member json;
  v_members json;
begin
  -- insert profile
  insert into public.profiles (
    id, email, first_name, last_name, address, phone,
    emergency_contact_name, emergency_contact_phone,
    payment_preference, photo_consent, role
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.raw_user_meta_data->>'emergency_contact_name',
    new.raw_user_meta_data->>'emergency_contact_phone',
    new.raw_user_meta_data->>'payment_preference',
    coalesce((new.raw_user_meta_data->>'photo_consent')::boolean, false),
    'member'
  );

  -- get current season
  select id into v_season_id
  from public.seasons
  where is_current = true
  limit 1;

  -- insert membership
  if v_season_id is not null then
    insert into public.memberships (profile_id, season_id, status, payment_confirmed)
    values (new.id, v_season_id, 'pending', false);
  end if;

  -- insert household members safely
  v_members := new.raw_user_meta_data->'householdMembers';

  if v_members is not null and json_array_length(v_members) > 0 then
    for v_member in select * from json_array_elements(v_members)
    loop
      insert into public.household_members (profile_id, first_name, last_name)
      values (
        new.id,
        v_member->>'first',
        v_member->>'last'
      );
    end loop;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."check_ins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "checked_in_by" "text" NOT NULL,
    "members_present" integer DEFAULT 1 NOT NULL,
    "guest_count" integer DEFAULT 0 NOT NULL,
    "total_present" integer GENERATED ALWAYS AS (("members_present" + "guest_count")) STORED,
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."check_ins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "is_member" boolean DEFAULT false,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_phone" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "headcount" integer NOT NULL,
    "notes" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "deposit_paid" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "event_start_time" time without time zone,
    "event_end_time" time without time zone,
    CONSTRAINT "event_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."event_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_confirmed" boolean DEFAULT false,
    "payment_confirmed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memberships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "payment_preference" "text",
    "photo_consent" boolean DEFAULT false,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_confirmed" boolean DEFAULT false,
    CONSTRAINT "profiles_payment_preference_check" CHECK (("payment_preference" = ANY (ARRAY['zelle'::"text", 'check'::"text", 'cash'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "is_current" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "gate_code" "text",
    "wifi_name" "text",
    "wifi_password" "text"
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_bookings"
    ADD CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_profile_id_season_id_key" UNIQUE ("profile_id", "season_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_year_key" UNIQUE ("year");



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."check_ins"
    ADD CONSTRAINT "check_ins_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_bookings"
    ADD CONSTRAINT "event_bookings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "bookings_admin_all" ON "public"."event_bookings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "bookings_insert_public" ON "public"."event_bookings" FOR INSERT WITH CHECK (true);



CREATE POLICY "bookings_read_own" ON "public"."event_bookings" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."check_ins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkins_admin_all" ON "public"."check_ins" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "checkins_insert_own" ON "public"."check_ins" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "checkins_read_own" ON "public"."check_ins" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."event_bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "household_admin_all" ON "public"."household_members" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "household_delete_own" ON "public"."household_members" FOR DELETE USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "household_insert_own" ON "public"."household_members" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "household_read_own" ON "public"."household_members" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_admin_all" ON "public"."memberships" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "memberships_insert_own" ON "public"."memberships" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "memberships_read_own" ON "public"."memberships" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_delete" ON "public"."profiles" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "profiles_admin_insert" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles_admin_read" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_read_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasons_admin_all" ON "public"."seasons" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "seasons_read_all" ON "public"."seasons" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





































































































































































GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."check_ins" TO "anon";
GRANT ALL ON TABLE "public"."check_ins" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."check_ins" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_bookings" TO "anon";
GRANT ALL ON TABLE "public"."event_bookings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_bookings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."household_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."memberships" TO "anon";
GRANT ALL ON TABLE "public"."memberships" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."memberships" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";
GRANT INSERT ON TABLE "public"."profiles" TO "supabase_auth_admin";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."seasons" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";



































