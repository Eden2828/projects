-- ============================================================
-- AdPilot — Seed / demo data
-- ============================================================
-- PREREQUISITE: create at least one user first via the AdPilot signup page
-- (/app/signup) or the Supabase Auth dashboard. The ap_users row is created
-- automatically by the ap_on_auth_user_created trigger.
--
-- This script attaches demo data to the FIRST ap_users row it finds and
-- promotes that user to admin so you can see the agency view. Re-running it
-- replaces the demo business ("עסק לדוגמה — מספרת רינה") and its children.
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_business_id uuid;
  v_draft_id uuid;
begin
  select id into v_user_id from public.ap_users order by created_at asc limit 1;
  if v_user_id is null then
    raise notice 'No ap_users found. Sign up first, then re-run this seed.';
    return;
  end if;

  -- Make this user an admin so /app/admin is visible.
  update public.ap_users set role = 'admin' where id = v_user_id;

  -- Clean any previous demo business for a fresh seed.
  delete from public.ap_businesses
   where user_id = v_user_id and business_name = 'עסק לדוגמה — מספרת רינה';

  insert into public.ap_businesses
    (user_id, business_name, industry, location, website_url, instagram_url,
     facebook_page_url, whatsapp_number, main_offer, monthly_budget, goal)
  values
    (v_user_id, 'עסק לדוגמה — מספרת רינה', 'יופי ועיצוב שיער', 'תל אביב',
     'https://example.co.il', 'https://instagram.com/rina_hair',
     'https://facebook.com/rina.hair', '+972541234567',
     'תספורת + פן ב-99 ₪ ללקוחות חדשים', 3000, 'leads')
  returning id into v_business_id;

  insert into public.ap_questionnaire_answers (business_id, answers_json)
  values (v_business_id, jsonb_build_object(
    'what_you_sell', 'שירותי תספורת, צבע ועיצוב שיער',
    'target_audience', 'נשים 25-45 מאזור המרכז',
    'service_area', 'תל אביב והסביבה',
    'tone_of_voice', 'חם, אישי ומקצועי',
    'promotions', 'תספורת + פן ב-99 ₪ ללקוח חדש',
    'competitors', 'מספרות שכונתיות באזור',
    'creative_assets', 'יש לוגו ותמונות לפני/אחרי'
  ));

  insert into public.ap_campaign_drafts
    (business_id, platform, objective, campaign_name, budget_type, daily_budget,
     target_audience_json, ad_sets_json, ads_json, creative_briefs_json, plan_json, status)
  values
    (v_business_id, 'meta', 'OUTCOME_LEADS', 'מספרת רינה — לקוחות חדשים', 'daily', 90,
     '{"strategy":"נשים 25-45 בטווח 10 ק""מ מתל אביב"}'::jsonb,
     '[{"ad_set_name":"נשים 25-45 ת""א","audience_summary":"מתעניינות ביופי ועיצוב שיער","age_min":25,"age_max":45,"genders":"נשים","locations":["תל אביב"],"interests":["עיצוב שיער","יופי"],"placements":["facebook_feed","instagram_feed"]}]'::jsonb,
     '[{"ad_name":"מבצע 99","primary_text":"תספורת + פן ב-99 ₪ בלבד ללקוחות חדשות!","headline":"מספרת רינה","description":"קבעי תור עכשיו","cta":"שליחת הודעה","creative_brief":"תמונת לפני/אחרי + לוגו"}]'::jsonb,
     '[{"ad_name":"מבצע 99","brief":"תמונת לפני/אחרי + לוגו"}]'::jsonb,
     '{"recommended_objective":"OUTCOME_LEADS","campaign_name":"מספרת רינה — לקוחות חדשים","budget_recommendation":{"budget_type":"daily","daily_budget":90,"currency":"ILS","rationale":"כ-3% מהתקציב החודשי ליום לבדיקה ראשונית"},"audience_strategy":"נשים 25-45 ברדיוס 10 ק""מ","ad_sets":[{"ad_set_name":"נשים 25-45 ת""א","audience_summary":"מתעניינות ביופי","age_min":25,"age_max":45,"genders":"נשים","locations":["תל אביב"],"interests":["עיצוב שיער","יופי"],"placements":["facebook_feed","instagram_feed"]}],"ads":[{"ad_name":"מבצע 99","primary_text":"תספורת + פן ב-99 ₪!","headline":"מספרת רינה","description":"קבעי תור","cta":"שליחת הודעה","creative_brief":"לפני/אחרי + לוגו"}],"landing_page_recommendation":"שלחו לוואטסאפ עם הודעה מוכנה מראש","risks_and_assumptions":["נדרשת תמונה איכותית","תחרות גבוהה באזור"],"optimization_plan_14_days":[{"day_range":"ימים 1-3","action":"לאסוף נתונים, לא לשנות תקציב"},{"day_range":"ימים 4-7","action":"לבדוק עלות לליד"},{"day_range":"ימים 8-14","action":"להגדיל תקציב למודעה המנצחת עד 20%"}]}'::jsonb,
     'draft')
  returning id into v_draft_id;

  insert into public.ap_recommendations
    (business_id, campaign_draft_id, recommendation_type, title, description, priority, status)
  values
    (v_business_id, v_draft_id, 'increase_budget', 'הגדלת תקציב למודעה מנצחת (+20%)',
     'ה-ROAS חזק. מומלץ להעלות את התקציב היומי מ-90 ל-108 ₪ (בתוך מגבלת 20%).', 'medium', 'pending');

  insert into public.ap_alerts (business_id, severity, title, message, status)
  values
    (v_business_id, 'high', 'קמפיין לא מציג', 'לא נרשמו חשיפות ב-24 השעות האחרונות.', 'open');

  insert into public.ap_performance_snapshots
    (business_id, campaign_id, date, spend, impressions, clicks, leads, purchases, revenue, cpa, roas)
  values
    (v_business_id, '120000000000001', current_date - 1, 88, 4200, 95, 7, 0, 0, 12.57, 0),
    (v_business_id, '120000000000001', current_date - 2, 90, 5100, 110, 9, 0, 0, 10.00, 0);

  insert into public.ap_audit_logs (business_id, actor_type, action, metadata_json)
  values (v_business_id, 'system', 'seed_loaded', '{}'::jsonb);

  raise notice 'AdPilot demo data seeded for user %', v_user_id;
end $$;
