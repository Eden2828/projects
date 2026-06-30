<?php
/**
 * Plugin Name: ThinkDigital Proposals Store
 * Description: אחסון משותף ("זיכרון האתר") למחולל ההצעות של ThinkDigital — טיוטות והסכמים חתומים נשמרים על הוורדפרס וכל מי שיש לו את סיסמת העמוד רואה את אותה ספרייה מכל מכשיר.
 * Version: 1.0
 * Author: ThinkDigital
 */

if (!defined('ABSPATH')) exit;

// שם ה-option שבו נשמרת כל הספרייה (מערך הצעות בפורמט JSON).
if (!defined('TD_PROPOSALS_OPTION')) define('TD_PROPOSALS_OPTION', 'td_proposals_library');

// 🔑 מפתח סודי משותף. חייב להיות *זהה* לקבוע TD_CLOUD_KEY שבתוך proposal-editor.html.
// כל מי שיש לו את המפתח (= כל מי שטוען את העמוד המוגן בסיסמה) יכול לקרוא/לכתוב את הספרייה.
if (!defined('TD_PROPOSALS_KEY')) define('TD_PROPOSALS_KEY', 'YOUR_TD_CLOUD_KEY');

/* ---------- helpers ---------- */
function td_proposals_read() {
    $raw = get_option(TD_PROPOSALS_OPTION, '');
    $items = $raw ? json_decode($raw, true) : array();
    return is_array($items) ? $items : array();
}
function td_proposals_write($items) {
    update_option(TD_PROPOSALS_OPTION, wp_json_encode(array_values($items)), false); // autoload=false
}
function td_proposals_auth(WP_REST_Request $req) {
    $key = $req->get_param('key');
    if ($key === null || $key === '') $key = $req->get_header('x-td-key');
    return is_string($key) && hash_equals(TD_PROPOSALS_KEY, $key);
}
// קוראים את גוף הבקשה ידנית (השליחה היא text/plain כדי להימנע מ-CORS preflight).
function td_proposals_body(WP_REST_Request $req) {
    $data = json_decode($req->get_body(), true);
    return is_array($data) ? $data : array();
}

/* ---------- REST routes ---------- */
add_action('rest_api_init', function () {

    // GET /wp-json/td/v1/library  → כל ההצעות
    register_rest_route('td/v1', '/library', array(
        'methods'             => 'GET',
        'permission_callback' => 'td_proposals_auth',
        'callback'            => function () {
            return array('ok' => true, 'items' => array_values(td_proposals_read()));
        },
    ));

    // POST /wp-json/td/v1/upsert  → מוסיף/מעדכן הצעה אחת (לפי id; הגרסה החדשה לפי savedAt מנצחת)
    register_rest_route('td/v1', '/upsert', array(
        'methods'             => 'POST',
        'permission_callback' => 'td_proposals_auth',
        'callback'            => function (WP_REST_Request $req) {
            $item = td_proposals_body($req);
            if (empty($item['id'])) return new WP_Error('td_bad', 'missing id', array('status' => 400));
            $items = td_proposals_read();
            $map = array();
            foreach ($items as $it) if (!empty($it['id'])) $map[$it['id']] = $it;
            $existing = isset($map[$item['id']]) ? $map[$item['id']] : null;
            $incoming_at = isset($item['savedAt']) ? (string) $item['savedAt'] : '';
            $existing_at = ($existing && isset($existing['savedAt'])) ? (string) $existing['savedAt'] : '';
            if (!$existing || strcmp($incoming_at, $existing_at) >= 0) {
                $map[$item['id']] = $item;
            }
            td_proposals_write(array_values($map));
            return array('ok' => true);
        },
    ));

    // POST /wp-json/td/v1/delete  → מחיקת הצעה ({"id":"..."}) או איפוס מלא ({"all":true})
    register_rest_route('td/v1', '/delete', array(
        'methods'             => 'POST',
        'permission_callback' => 'td_proposals_auth',
        'callback'            => function (WP_REST_Request $req) {
            $p = td_proposals_body($req);
            if (!empty($p['all'])) {
                td_proposals_write(array());
            } elseif (!empty($p['id'])) {
                $items = array_filter(td_proposals_read(), function ($it) use ($p) {
                    return (isset($it['id']) ? $it['id'] : '') !== $p['id'];
                });
                td_proposals_write(array_values($items));
            }
            return array('ok' => true);
        },
    ));
});

/* ---------- CORS (גיבוי) ----------
 * האפליקציה רצה בתוך iframe srcdoc שיורש את origin של thinkdigital.co.il, כך שהבקשות
 * הן same-origin ולרוב לא צריך CORS בכלל. ההרשאה היא דרך המפתח (לא עוגיות), לכן * בטוח.
 */
add_filter('rest_pre_serve_request', function ($served) {
    $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    if (strpos($uri, '/td/v1/') !== false) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-TD-Key');
    }
    return $served;
}, 10);
