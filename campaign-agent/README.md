# Campaign Agent — כלי AI פנימי לקמפיינרים

כלי **פנימי בלבד** (לקמפיינרים ולבעלי הסוכנות — אין גישת לקוחות) שעושה שני דברים:

1. **AGENT לפי דרישה** — שואלים בשפה חופשית ("מה באוויר בחשבון X?", "איך היה השבוע
   האחרון?", "מה התקציב?") וה-agent (Claude) שולף נתונים חיים מ-Meta ועונה בעברית.
2. **פאנל התראות** — סריקה אוטומטית שמתריעה על בעיות (CPA חורג, קמפיין פעיל בלי הוצאה,
   מודעה שנדחתה, מתקרבים לתקרת תקציב, וכו').

> מקור נתונים נוכחי: **Meta Ads** (קריאה-בלבד). Google Ads מתוכנן כמודול נפרד בהמשך.

---

## התקנה והרצה (מקומי, Windows)

```powershell
cd campaign-agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### הגדרות

1. **`.env`** — העתק מ-`.env.example` ומלא מפתחות. הקובץ קורא קודם את `.env` המקומי, ואז
   נופל ל-`.env` של תיקיית האב (שם כבר יש `ANTHROPIC_API_KEY` / `META_*` במחשב הזה).
   חובה: `ANTHROPIC_API_KEY`, `META_ACCESS_TOKEN` (long-lived).

2. **`config/accounts.json`** — העתק מ-`accounts.example.json` והכנס את חשבונות המודעות
   האמיתיים (`ad_account_id` בפורמט `act_XXXX`, יעדי CPA/ROAS, תקציב חודשי, קמפיינר אחראי).

3. **`config/users.json`** — העתק מ-`users.example.json`. צור hash לסיסמה לכל משתמש:

   ```powershell
   python -m backend.auth hash "הסיסמה-שלך"
   ```

   והדבק את התוצאה ל-`password_hash`.

4. **`config/rules.json`** — ספי ההתראות. אפשר להתאים לכל לקוח תחת `client_overrides`.

### הרצה

```powershell
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

פתח את הדפדפן ב-http://localhost:8000 והתחבר.

---

## איך זה עובד

- **`backend/connectors/meta.py`** — לקוח Meta API קריאה-בלבד (GET בלבד, throttle, backoff).
- **`backend/connectors/base.py`** — שכבת נרמול שמפרידה את ה-agent מהפלטפורמה (כאן ייכנס
  Google Ads בעתיד).
- **`backend/agent/`** — ה-agent: system prompt בעברית, הגדרות tools, ולולאת tool-use
  סטרימינג מול Claude (מודל ברירת מחדל `claude-opus-4-8`).
- **`backend/alerts/`** — מנוע החוקים (`engine.py`) + scheduler (`scheduler.py`) שרץ כל
  `SCAN_INTERVAL_MINUTES` דקות, שומר snapshots ב-SQLite ומזהה מגמות.
- **`backend/db.py`** — SQLite מקומי (`data/campaign_agent.db`): snapshots, alerts, היסטוריית צ'אט.
- **`frontend/`** — דף יחיד (RTL עברית): צ'אט + פאנל התראות.

## בטיחות

הכלי **קריאה-בלבד**. ה-agent מונחה במפורש להמליץ רק על צעדים ידניים ב-Ads Manager,
ולעולם לא לבצע שינויים דרך API. ה-Meta client מסוגל מבנית רק ל-GET.

## פתרון בעיות

- **401 מ-Meta / "Meta API error"** — ה-`META_ACCESS_TOKEN` פג או חסר. צור token חדש
  (long-lived) והכנס ל-`.env`.
- **"ANTHROPIC_API_KEY חסר"** — הגדר ב-`.env`.
- כל המשתמשים מתנתקים בהפעלה מחדש של השרת (sessions בזיכרון) — תקין לכלי פנימי.
