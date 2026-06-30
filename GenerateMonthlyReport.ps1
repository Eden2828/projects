<#
.SYNOPSIS
    Monthly performance presentation generator using Meta Marketing API.

.DESCRIPTION
    Pulls campaign data + demographics from Meta Ads Manager and generates
    a branded PPTX presentation automatically.

.EXAMPLE
    .\GenerateMonthlyReport.ps1 `
        -AccessToken  "EAAxxxxx..." `
        -AdAccountId  "act_123456789" `
        -ClientName   "CUE" `
        -Month        5 `
        -Year         2026

.EXAMPLE - Multiple clients at once:
    $clients = @(
        @{ AdAccountId="act_111"; ClientName="CUE"      },
        @{ AdAccountId="act_222"; ClientName="פאנקי"    },
        @{ AdAccountId="act_333"; ClientName="רוסטיקו"  }
    )
    $token = "EAAxxxxx..."
    foreach ($c in $clients) {
        .\GenerateMonthlyReport.ps1 -AccessToken $token -AdAccountId $c.AdAccountId -ClientName $c.ClientName -Month 5 -Year 2026
    }
#>

param(
    [Parameter(Mandatory=$true)]  [string]$AccessToken,
    [Parameter(Mandatory=$true)]  [string]$AdAccountId,   # e.g. act_123456789
    [Parameter(Mandatory=$true)]  [string]$ClientName,
    [Parameter(Mandatory=$true)]  [int]   $Month,
    [Parameter(Mandatory=$true)]  [int]   $Year,
    [string]$TemplatePath = "C:\Users\Guy\Downloads\וין אנד ויאנדה - מאי.pptx",
    [string]$OutputDir    = "C:\Users\Guy\Downloads"
)

# ─────────────────────────── CONFIG ───────────────────────────
$API_BASE = "https://graph.facebook.com/v21.0"
$HE_MONTHS = @{1="ינואר";2="פברואר";3="מרץ";4="אפריל";5="מאי";6="יוני";
               7="יולי";8="אוגוסט";9="ספטמבר";10="אוקטובר";11="נובמבר";12="דצמבר"}

$heMonth  = $HE_MONTHS[$Month]
$lastDay  = [DateTime]::DaysInMonth($Year, $Month)
$start    = "$Year-$($Month.ToString('00'))-01"
$end      = "$Year-$($Month.ToString('00'))-$($lastDay.ToString('00'))"
$dateLabel = "$heMonth $Year"
$dateRange = "01/$($Month.ToString('00'))/$Year – $($lastDay.ToString('00'))/$($Month.ToString('00'))/$Year"
$timeRange = "{`"since`":`"$start`",`"until`":`"$end`"}"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  $ClientName | $dateLabel" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# ─────────────────────────── META API ───────────────────────────
function Invoke-MetaAPI([string]$path, [hashtable]$params) {
    $params["access_token"] = $AccessToken
    $qs = ($params.GetEnumerator() | ForEach-Object {
        "$([Uri]::EscapeDataString($_.Key))=$([Uri]::EscapeDataString($_.Value))"
    }) -join "&"
    try {
        $resp = Invoke-RestMethod -Uri "$API_BASE/$path`?$qs" -Method GET -TimeoutSec 30
        return $resp.data
    } catch {
        $msg = $_.Exception.Message
        Write-Warning "API error on /$path : $msg"
        return @()
    }
}

Write-Host "Fetching campaign insights..." -ForegroundColor DarkCyan
$campaigns = Invoke-MetaAPI "$AdAccountId/insights" @{
    fields     = "campaign_name,spend,impressions,reach,clicks,actions,cost_per_action_type"
    time_range = $timeRange
    level      = "campaign"
    limit      = "200"
}

$active = @($campaigns | Where-Object { [float]($_.spend) -gt 0 })
if ($active.Count -eq 0) {
    Write-Warning "No active campaigns found for $ClientName in $dateLabel. Skipping."
    return
}
Write-Host "  Found $($active.Count) active campaigns" -ForegroundColor DarkGray

Write-Host "Fetching demographic breakdowns..." -ForegroundColor DarkCyan
$genderData   = Invoke-MetaAPI "$AdAccountId/insights" @{ fields="spend"; time_range=$timeRange; level="account"; breakdowns="gender";             limit="50" }
$ageData      = Invoke-MetaAPI "$AdAccountId/insights" @{ fields="spend"; time_range=$timeRange; level="account"; breakdowns="age";                limit="50" }
$platformData = Invoke-MetaAPI "$AdAccountId/insights" @{ fields="spend"; time_range=$timeRange; level="account"; breakdowns="publisher_platform"; limit="50" }

# ─────────────────────────── DATA PROCESSING ───────────────────────────

# Totals
$totalSpend  = 0; foreach ($c in $active) { $totalSpend  += [float]$c.spend }
$totalImpres = 0; foreach ($c in $active) { $totalImpres += [int]$c.impressions }
$totalSpend  = [math]::Round($totalSpend, 0)

function Get-PrimaryResult($c) {
    if (-not $c.actions) { return @{count=0; type=""; cpr=0} }
    $a = @($c.actions | Where-Object { $_.action_type -notmatch "^(post_|page_|video_)" })
    if ($a.Count -eq 0) { return @{count=0; type=""; cpr=0} }
    $top = $a | Sort-Object { [int]$_.value } -Descending | Select-Object -First 1
    $cprObj = $c.cost_per_action_type | Where-Object { $_.action_type -eq $top.action_type } | Select-Object -First 1
    return @{
        count = [int]$top.value
        type  = $top.action_type
        cpr   = if ($cprObj) { [math]::Round([float]$cprObj.value, 2) } else { 0 }
    }
}

function Get-ResultLabel([string]$type, [int]$count) {
    switch -Wildcard ($type) {
        "*purchase*"  { return "$count רכישות"       }
        "*leadgen*"   { return "$count לידים"         }
        "*lead*"      { return "$count לידים"         }
        "*messaging*" { return "$count שיחות ווטסאפ" }
        default       { return if ($count -gt 0) { "$count תוצאות" } else { "" } }
    }
}

function Get-CampaignDisplayName([string]$raw) {
    $n = $raw -replace "[‎‏‪-‮]", ""  # strip Unicode directional marks
    if ($n -match "druhim|דרושים") {
        if ($n -match "טבח")   { return "קמפיין דרושים טבחים" }
        if ($n -match "מלצר")  { return "קמפיין דרושים מלצרים" }
        if ($n -match "מארח")  { return "קמפיין דרושים מארחות" }
        if ($n -match "מנהל")  { return "קמפיין דרושים מנהלים" }
        return "קמפיין דרושים"
    }
    if ($n -match "[Oo]ntopo|אונטופו") { return "קמפיין הזמנות Ontopo" }
    if ($n -match "משלוח")             { return "קמפיין משלוחים" }
    if ($n -match "חשיפ")              { return "קמפיין חשיפה" }
    if ($n -match "מעורב")             { return "קמפיין מעורבות" }
    # Fallback: truncate to 30 chars
    if ($n.Length -gt 30) { return $n.Substring(0, 28) + "..." }
    return $n
}

# Build campaign boxes (max 4, sorted by spend desc)
$boxData = @()
$sorted  = $active | Sort-Object { [float]$_.spend } -Descending | Select-Object -First 4
foreach ($c in $sorted) {
    $res = Get-PrimaryResult $c
    $boxData += @{
        name   = Get-CampaignDisplayName $c.campaign_name
        budget = "$($([math]::Round([float]$c.spend)).ToString('N0'))₪"
        result = Get-ResultLabel $res.type $res.count
        spend  = [float]$c.spend
    }
}

# Top KPI box 3 & 4 — detect if Ontopo exists
$ontopoCamp = $active | Where-Object { $_.campaign_name -match "[Oo]ntopo|אונטופו" } | Select-Object -First 1
if ($ontopoCamp) {
    $r3            = Get-PrimaryResult $ontopoCamp
    $kpi3Value     = "$($r3.count)"
    $kpi3Label     = "הזמנות באונטופו"
    $kpi3EnLabel   = "Website Bookings"
    $kpi4Value     = if ($r3.count -gt 0) { "$([math]::Round([float]$ontopoCamp.spend / $r3.count, 2))₪" } else { "N/A" }
    $kpi4Label     = "📊 עלות להזמנה"
    $kpi4EnLabel   = "Cost per Booking"
} else {
    $totalResults  = 0; foreach ($c in $active) { $totalResults += (Get-PrimaryResult $c).count }
    $kpi3Value     = "$totalResults"
    $kpi3Label     = "סה`"כ תוצאות"
    $kpi3EnLabel   = "Total Results"
    $kpi4Value     = if ($totalResults -gt 0) { "$([math]::Round($totalSpend / $totalResults, 2))₪" } else { "N/A" }
    $kpi4Label     = "📊 עלות לתוצאה"
    $kpi4EnLabel   = "Cost per Result"
}

# Demographics
function Sum-Field($arr, [string]$filterKey, [string]$filterVal, [string]$field) {
    $total = 0
    foreach ($r in $arr) {
        if ($filterKey -eq "" -or $r.$filterKey -eq $filterVal) {
            $v = $r.$field; if ($v) { $total += [float]$v }
        }
    }
    return $total
}

$gTotal   = Sum-Field $genderData   "" "" "spend"
$gFemale  = Sum-Field $genderData   "gender" "female"  "spend"
$gMale    = Sum-Field $genderData   "gender" "male"    "spend"
$gUnknown = Sum-Field $genderData   "gender" "unknown" "spend"

$pTotal   = Sum-Field $platformData "" "" "spend"
$pFb      = Sum-Field $platformData "publisher_platform" "facebook"         "spend"
$pIg      = Sum-Field $platformData "publisher_platform" "instagram"        "spend"
$pAn      = Sum-Field $platformData "publisher_platform" "audience_network" "spend"

$femalePct  = if ($gTotal -gt 0) { [math]::Round($gFemale  / $gTotal * 100, 1) } else { 0 }
$malePct    = if ($gTotal -gt 0) { [math]::Round($gMale    / $gTotal * 100, 1) } else { 0 }
$unknownPct = if ($gTotal -gt 0) { [math]::Round($gUnknown / $gTotal * 100, 1) } else { 0 }
$fbPct      = if ($pTotal -gt 0) { [math]::Round($pFb      / $pTotal * 100, 1) } else { 0 }
$igPct      = if ($pTotal -gt 0) { [math]::Round($pIg      / $pTotal * 100, 1) } else { 0 }
$anPct      = if ($pTotal -gt 0) { [math]::Round($pAn      / $pTotal * 100, 1) } else { 0 }

# ─────────────────────────── PPTX GENERATION ───────────────────────────
$outputPath = Join-Path $OutputDir "$ClientName - $dateLabel.pptx"
Copy-Item $TemplatePath $outputPath -Force
Write-Host "Building PPTX: $outputPath" -ForegroundColor DarkCyan

$ppt  = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
$pres = $ppt.Presentations.Open($outputPath)

function Set-ShapeText($shape, [string]$text) {
    if ($shape.HasTextFrame) { $shape.TextFrame.TextRange.Text = $text }
}

# ── Slide 1: Title ──────────────────────────────────────────
$s1 = $pres.Slides(1)
Set-ShapeText $s1.Shapes(1) $ClientName
Set-ShapeText $s1.Shapes(3) "סיכום ביצועים | $dateLabel"

# ── Slide 2: Overview ───────────────────────────────────────
$s2 = $pres.Slides(2)
Set-ShapeText $s2.Shapes(2) "$dateLabel  |  $dateRange"

# KPI boxes (top row)
Set-ShapeText $s2.Shapes(6)  "$($totalSpend.ToString('N0'))₪"
Set-ShapeText $s2.Shapes(11) "$($totalImpres.ToString('N0'))"
Set-ShapeText $s2.Shapes(15) $kpi3Label
Set-ShapeText $s2.Shapes(16) $kpi3Value
Set-ShapeText $s2.Shapes(17) $kpi3EnLabel
Set-ShapeText $s2.Shapes(20) $kpi4Label
Set-ShapeText $s2.Shapes(21) $kpi4Value
Set-ShapeText $s2.Shapes(22) $kpi4EnLabel

# Campaign breakdown boxes (bottom row)
$numBoxes = $boxData.Count

if ($numBoxes -ge 4) {
    # ── Resize template from 3 → 4 boxes ────────────────────
    $bW   = 161; $bInW = 144; $bPad = 8.7; $bGap = 14.0
    $bX   = @(15.8, (15.8+$bW+$bGap), (15.8+2*($bW+$bGap)), (15.8+3*($bW+$bGap)))

    for ($b = 0; $b -lt 3; $b++) {
        $base = 25 + $b*5
        $s2.Shapes($base  ).Left = $bX[$b]; $s2.Shapes($base  ).Width = $bW
        $s2.Shapes($base+1).Left = $bX[$b]; $s2.Shapes($base+1).Width = $bW
        $s2.Shapes($base+2).Left = $bX[$b]+$bPad; $s2.Shapes($base+2).Width = $bInW
        $s2.Shapes($base+3).Left = $bX[$b]+$bPad; $s2.Shapes($base+3).Width = $bInW
        $s2.Shapes($base+4).Left = $bX[$b]+$bPad; $s2.Shapes($base+4).Width = $bInW
    }

    # Duplicate box 3 → box 4
    $box4Shapes = @()
    foreach ($idx in @(35,36,37,38,39)) {
        $s2.Shapes($idx).Copy()
        $pasted = $s2.Shapes.Paste()
        $ns = $pasted.Item(1)
        $ns.Left = $bX[3] + ($s2.Shapes($idx).Left - $bX[2])
        $ns.Top  = $s2.Shapes($idx).Top
        $box4Shapes += $ns
    }

    # Write text: boxes 1–3
    Set-ShapeText $s2.Shapes(27) $boxData[0].name; Set-ShapeText $s2.Shapes(28) $boxData[0].budget; Set-ShapeText $s2.Shapes(29) $boxData[0].result
    Set-ShapeText $s2.Shapes(32) $boxData[1].name; Set-ShapeText $s2.Shapes(33) $boxData[1].budget; Set-ShapeText $s2.Shapes(34) $boxData[1].result
    Set-ShapeText $s2.Shapes(37) $boxData[2].name; Set-ShapeText $s2.Shapes(38) $boxData[2].budget; Set-ShapeText $s2.Shapes(39) $boxData[2].result
    Set-ShapeText $box4Shapes[2] $boxData[3].name; Set-ShapeText $box4Shapes[3] $boxData[3].budget; Set-ShapeText $box4Shapes[4] $boxData[3].result
} else {
    # 3 boxes (original layout)
    for ($b = 0; $b -lt 3; $b++) {
        $base = 25 + $b*5
        $d    = if ($b -lt $boxData.Count) { $boxData[$b] } else { @{name="";budget="";result=""} }
        Set-ShapeText $s2.Shapes($base+2) $d.name
        Set-ShapeText $s2.Shapes($base+3) $d.budget
        Set-ShapeText $s2.Shapes($base+4) $d.result
    }
}

# ── Slide 4: Demographics ───────────────────────────────────
$s4 = $pres.Slides(4)
Set-ShapeText $s4.Shapes(2) "חלוקת תקציב לפי גיל, מגדר ופלטפורמה | $dateLabel"

# Gender text
Set-ShapeText $s4.Shapes(11) "$([math]::Round($gFemale,0).ToString('N0'))₪  $femalePct%"
Set-ShapeText $s4.Shapes(16) "$([math]::Round($gMale,0).ToString('N0'))₪  $malePct%"
Set-ShapeText $s4.Shapes(21) "$([math]::Round($gUnknown,0).ToString('N0'))₪  $unknownPct%"

# Platform text
Set-ShapeText $s4.Shapes(28) "$([math]::Round($pFb,0).ToString('N0'))₪  $fbPct%"
Set-ShapeText $s4.Shapes(33) "$([math]::Round($pIg,0).ToString('N0'))₪  $igPct%"
Set-ShapeText $s4.Shapes(38) "$([math]::Round($pAn,0).ToString('N0'))₪  $anPct%"

# Progress bars — scale relative to the largest value in each group
$maxG = [math]::Max([math]::Max($gFemale, $gMale), $gUnknown)
$maxP = [math]::Max([math]::Max($pFb, $pIg), $pAn)
if ($maxG -gt 0) {
    $s4.Shapes(10).Width = [math]::Max(1, [math]::Round($gFemale  / $maxG * 141))
    $s4.Shapes(15).Width = [math]::Max(1, [math]::Round($gMale    / $maxG * 141))
    $s4.Shapes(20).Width = [math]::Max(1, [math]::Round($gUnknown / $maxG * 141))
}
if ($maxP -gt 0) {
    $s4.Shapes(27).Width = [math]::Max(1, [math]::Round($pFb / $maxP * 140))
    $s4.Shapes(32).Width = [math]::Max(1, [math]::Round($pIg / $maxP * 140))
    $s4.Shapes(37).Width = [math]::Max(1, [math]::Round($pAn / $maxP * 140))
}

# ── Save ────────────────────────────────────────────────────
$pres.Save()
$pres.Close()
$ppt.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt)  | Out-Null

Write-Host "Done! → $outputPath" -ForegroundColor Green
Write-Host ""
Write-Host "SUMMARY:" -ForegroundColor Yellow
Write-Host "  Total Spend:    $($totalSpend.ToString('N0'))₪"
Write-Host "  Impressions:    $($totalImpres.ToString('N0'))"
Write-Host "  Campaigns:      $numBoxes active"
Write-Host "  Note: Slide 3 (top ads) must be updated manually with client creative."
