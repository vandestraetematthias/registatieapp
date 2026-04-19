# ==============================================================
#  REGISTRATIE-APP  --  Volledig script (Sectie 1 t/m 11)
#  Encoding: UTF-8 zonder BOM
#  Gebruik:  . .\RegistratieApp_Volledig.ps1
# ==============================================================

# ==============================================================
# SECTIE 1 : CONFIGURATIE & PADEN
# ==============================================================

$script:Config = @{
    DataPad         = "$PSScriptRoot\data"
    ArchivePad      = "$PSScriptRoot\data\archief"
    ExportPad       = "$PSScriptRoot\exports"
    PersonenFile    = "$PSScriptRoot\data\personen.json"
    CollectiefFile  = "$PSScriptRoot\data\collectief_log.json"
    IndividueelFile = "$PSScriptRoot\data\individueel_log.json"
}

foreach ($pad in @($script:Config.DataPad, $script:Config.ArchivePad, $script:Config.ExportPad)) {
    if (-not (Test-Path $pad)) {
        New-Item -ItemType Directory -Path $pad -Force | Out-Null
    }
}

# ==============================================================
# SECTIE 2 : DATA-STRUCTUREN (PSCustomObject)
# ==============================================================

function Get-VolgNummer {
    $personen = Read-JsonFile $script:Config.PersonenFile
    if ($personen.Count -eq 0) { return 1 }
    return (($personen | Measure-Object -Property Volgnummer -Maximum).Maximum + 1)
}

function New-Persoon {
    param(
        [string]$Voornaam,
        [string]$Familienaam,
        [string]$Adres,
        [string]$Postcode,
        [string]$Gemeente,
        [string[]]$Inkomen       = @(),
        [string[]]$Woonsituatie  = @(),
        [string]$Gekend          = "Niet Gekend",
        [int]$GekendJaartal      = 0,
        [string[]]$EersteContact = @(),
        [string[]]$GekendBij     = @(),
        [string]$Notitie         = ""
    )

    $volgNummer = Get-VolgNummer

    [PSCustomObject]@{
        Volgnummer    = $volgNummer
        Voornaam      = $Voornaam
        Familienaam   = $Familienaam
        Adres         = $Adres
        Postcode      = $Postcode
        Gemeente      = $Gemeente
        Inkomen       = $Inkomen
        Woonsituatie  = $Woonsituatie
        Gekend        = $Gekend
        GekendJaartal = $GekendJaartal
        EersteContact = $EersteContact
        GekendBij     = $GekendBij
        Notitie       = $Notitie
        Aangemaakt    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status        = "actief"
    }
}

function New-IndividueleActie {
    param(
        [string]$Maand,
        [int]$Volgnummer,
        [string[]]$Vindplaats    = @(),
        [string]$Tijd            = "",
        [string[]]$Levensdomein  = @(),
        [string[]]$Methodiek     = @(),
        [string]$ExtraInfo       = "",
        [string[]]$Toeleiding    = @()
    )

    [PSCustomObject]@{
        ID            = [System.Guid]::NewGuid().ToString()
        Maand         = $Maand
        Jaar          = (Get-Date).Year
        PersoonNummer = $Volgnummer
        Vindplaats    = $Vindplaats
        Tijd          = $Tijd
        Levensdomein  = $Levensdomein
        Methodiek     = $Methodiek
        ExtraInfo     = $ExtraInfo
        Toeleiding    = $Toeleiding
        Datum         = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status        = "actief"
    }
}

function New-CollectieveActie {
    param(
        [string]$Maand,
        [Parameter(Mandatory)][string]$NaamVanDeActie,
        [string[]]$TypeActie             = @(),
        [string]$Duur                    = "",
        [string[]]$Cluster               = @(),
        [string[]]$Thema                 = @(),
        [int]$AantalBewoners             = 0,
        [int]$WaarvanNieuweBewoners      = 0,
        [int]$AantalVrijwilligers        = 0,
        [string[]]$NaamVrijwilligers     = @(),
        [string]$NaamPartner             = ""
    )

    $totaal = $AantalBewoners + $AantalVrijwilligers

    [PSCustomObject]@{
        ID                    = [System.Guid]::NewGuid().ToString()
        Module                = $null
        Maand                 = $Maand
        Jaar                  = (Get-Date).Year
        TypeActie             = $TypeActie
        NaamVanDeActie        = $NaamVanDeActie
        Duur                  = $Duur
        Cluster               = $Cluster
        Thema                 = $Thema
        AantalBewoners        = $AantalBewoners
        WaarvanNieuweBewoners = $WaarvanNieuweBewoners
        AantalVrijwilligers   = $AantalVrijwilligers
        NaamVrijwilligers     = $NaamVrijwilligers
        TotaalBereikte        = $totaal
        NaamPartner           = $NaamPartner
        Datum                 = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status                = "actief"
    }
}

function New-LogistiekRecord {
    param(
        [Parameter(Mandatory)][string]$NaamVanDeActie,
        [string]$Datum           = "",
        [string[]]$UitlegType    = @(),
        [object[]]$Uitgaven      = @(),
        [bool]$Signalen          = $false,
        [string[]]$SignaalTypes  = @(),
        [string]$Notitie         = ""
    )

    [PSCustomObject]@{
        ID             = [System.Guid]::NewGuid().ToString()
        Module         = "Logistiek"
        NaamVanDeActie = $NaamVanDeActie
        Datum          = $Datum
        UitlegType     = $UitlegType
        Uitgaven       = $Uitgaven
        Signalen       = $Signalen
        SignaalTypes   = $SignaalTypes
        Notitie        = $Notitie
        Aangemaakt     = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status         = "actief"
    }
}

function New-OverlegRecord {
    param(
        [Parameter(Mandatory)][string]$NaamVanDeActie,
        [string]$Datum          = "",
        [bool]$Signalen         = $false,
        [string[]]$SignaalTypes = @(),
        [string]$Notitie        = ""
    )

    [PSCustomObject]@{
        ID             = [System.Guid]::NewGuid().ToString()
        Module         = "Overleg"
        NaamVanDeActie = $NaamVanDeActie
        Datum          = $Datum
        Signalen       = $Signalen
        SignaalTypes   = $SignaalTypes
        Notitie        = $Notitie
        Aangemaakt     = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status         = "actief"
    }
}

function New-ActiviteitRecord {
    param(
        [Parameter(Mandatory)][string]$NaamVanDeActie,
        [string]$Locatie         = "",
        [string]$Type            = "",
        [object[]]$Uitgaven      = @(),
        [object[]]$Inkomsten     = @(),
        [string[]]$Participatie  = @(),
        [string[]]$Doel          = @(),
        [string[]]$Impact        = @(),
        [bool]$Signalen          = $false,
        [string[]]$SignaalTypes  = @(),
        [string]$Notitie         = ""
    )

    [PSCustomObject]@{
        ID             = [System.Guid]::NewGuid().ToString()
        Module         = "Activiteit"
        NaamVanDeActie = $NaamVanDeActie
        Locatie        = $Locatie
        Type           = $Type
        Uitgaven       = $Uitgaven
        Inkomsten      = $Inkomsten
        Participatie   = $Participatie
        Doel           = $Doel
        Impact         = $Impact
        Signalen       = $Signalen
        SignaalTypes   = $SignaalTypes
        Notitie        = $Notitie
        Aangemaakt     = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        Status         = "actief"
    }
}

# ==============================================================
# SECTIE 3 : JSON HULPFUNCTIES
# ==============================================================

function Read-JsonFile {
    param([string]$Pad)
    if (-not (Test-Path $Pad)) { return @() }
    $json = Get-Content $Pad -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($json)) { return @() }
    return ($json | ConvertFrom-Json)
}

function Write-JsonFile {
    param([string]$Pad, [object]$Data)
    $Data | ConvertTo-Json -Depth 10 | Set-Content -Path $Pad -Encoding UTF8
}

function Add-ToJsonFile {
    param([string]$Pad, [object]$NieuwRecord)
    $bestaande = Read-JsonFile $Pad
    $lijst = [System.Collections.Generic.List[object]]::new()
    foreach ($item in $bestaande) { $lijst.Add($item) }
    $lijst.Add($NieuwRecord)
    Write-JsonFile $Pad $lijst
}

# ==============================================================
# SECTIE 4 : GROEPERING PER SLEUTEL
# ==============================================================

function Get-CollectiefGroepeerdPerNaam {
    $log = Read-JsonFile $script:Config.CollectiefFile
    $log | Where-Object { $_.Status -eq "actief" } |
           Group-Object -Property NaamVanDeActie
}

function Get-BestaandeActieNamen {
    $log = Read-JsonFile $script:Config.CollectiefFile
    $log | Where-Object { -not [string]::IsNullOrWhiteSpace($_.NaamVanDeActie) } |
           Select-Object -ExpandProperty NaamVanDeActie |
           Select-Object -Unique |
           Sort-Object
}

# ==============================================================
# SECTIE 5 : FICHE LOGICA
# ==============================================================

function Get-FichePerActie {
    param([string]$NaamFilter = "*")

    $groepenCollectief = Get-CollectiefGroepeerdPerNaam
    $alleLogRecords    = Read-JsonFile $script:Config.CollectiefFile

    $fiches = foreach ($groep in $groepenCollectief) {

        $naam    = $groep.Name
        if ($naam -notlike $NaamFilter) { continue }
        $acties  = $groep.Group

        $logistiek  = $alleLogRecords | Where-Object { $_.NaamVanDeActie -eq $naam -and $_.Module -eq "Logistiek"  -and $_.Status -eq "actief" }
        $overleg    = $alleLogRecords | Where-Object { $_.NaamVanDeActie -eq $naam -and $_.Module -eq "Overleg"    -and $_.Status -eq "actief" }
        $activiteit = $alleLogRecords | Where-Object { $_.NaamVanDeActie -eq $naam -and $_.Module -eq "Activiteit" -and $_.Status -eq "actief" }

        # Unieke vrijwilligers
        $alleNamen             = $acties | ForEach-Object { $_.NaamVrijwilligers } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        $uniekeVrijwilligers   = $alleNamen | Select-Object -Unique
        $aantalUniek           = ($uniekeVrijwilligers | Measure-Object).Count

        # Bereik
        $totaalBewoners        = ($acties | Measure-Object -Property AantalBewoners        -Sum).Sum
        $totaalNieuweBewoners  = ($acties | Measure-Object -Property WaarvanNieuweBewoners -Sum).Sum
        $totaalBereik          = $totaalBewoners + $aantalUniek

        # Financieel
        $uitLogistiek = ($logistiek | ForEach-Object {
            $_.Uitgaven | ForEach-Object { [decimal]$_.Bedrag }
        } | Measure-Object -Sum).Sum

        $uitActiviteit = ($activiteit | ForEach-Object {
            $_.Uitgaven | ForEach-Object { [decimal]$_.Bedrag }
        } | Measure-Object -Sum).Sum

        $inkomstenAct = ($activiteit | ForEach-Object {
            $_.Inkomsten | ForEach-Object { [decimal]$_.Bedrag }
        } | Measure-Object -Sum).Sum

        $totaalUit  = $uitLogistiek + $uitActiviteit
        $netto      = $inkomstenAct - $totaalUit

        # Signalen
        $alleSignalen = @()
        foreach ($r in (@($logistiek) + @($overleg) + @($activiteit))) {
            if ($r.Signalen -eq $true) { $alleSignalen += $r.SignaalTypes }
        }

        $alleNotities = ((@($logistiek) + @($overleg) + @($activiteit)) |
            Where-Object { $_.Notitie -ne "" } |
            ForEach-Object { "[$($_.Module) $($_.Datum)] $($_.Notitie)" }) -join "`n"

        [PSCustomObject]@{
            NaamVanDeActie            = $naam
            TotaalAantalBewoners      = $totaalBewoners
            WaarvanNieuweBewoners     = $totaalNieuweBewoners
            TotaalUniekeVrijwilligers = $aantalUniek
            NamenVrijwilligers        = ($uniekeVrijwilligers -join ", ")
            TotaalBereikte            = $totaalBereik
            AantalXLogistiek          = (@($logistiek) | Measure-Object).Count
            AantalXOverleg            = (@($overleg)   | Measure-Object).Count
            Type                      = ($activiteit | Select-Object -ExpandProperty Type -Unique) -join ", "
            Locaties                  = (($activiteit | Select-Object -ExpandProperty Locatie -Unique) -join ", ")
            Rollen                    = (($acties | ForEach-Object { $_.Cluster } | Select-Object -Unique) -join ", ")
            Doelen                    = (($activiteit | ForEach-Object { $_.Doel } | Select-Object -Unique) -join ", ")
            Signalen                  = ($alleSignalen | Select-Object -Unique) -join ", "
            TotaalUitgaven            = [math]::Round($totaalUit, 2)
            TotaalInkomsten           = [math]::Round($inkomstenAct, 2)
            NettoResultaat            = [math]::Round($netto, 2)
            Notities                  = $alleNotities
        }
    }

    return $fiches
}

# ==============================================================
# SECTIE 6 : EXPORT NAAR CSV
# ==============================================================

function Invoke-PeriodeFilter {
    param($Data, [string]$Maand, [string]$Periode, [int]$Jaar)

    if ($Jaar -gt 0)   { $Data = $Data | Where-Object { $_.Jaar -eq $Jaar } }
    if ($Maand -ne "") { $Data = $Data | Where-Object { $_.Maand -eq $Maand } }

    if ($Periode -ne "") {
        $maandNamen = @('','Januari','Februari','Maart','April','Mei','Juni',
                        'Juli','Augustus','September','Oktober','November','December')
        $delen = $Periode -split ":"
        $van   = [datetime]::ParseExact($delen[0], "yyyy-MM", $null)
        $tot   = [datetime]::ParseExact($delen[1], "yyyy-MM", $null)
        $Data  = $Data | Where-Object {
            $idx = [array]::IndexOf($maandNamen, $_.Maand)
            if ($idx -lt 1) { return $false }
            $mnd = [datetime]::new($_.Jaar, $idx, 1)
            $mnd -ge $van -and $mnd -le $tot
        }
    }

    return $Data
}

function Export-ToExcel {
    param(
        [ValidateSet("Personen","Individueel","Collectief","Fiches")]
        [string]$RapportType,
        [string]$Maand   = "",
        [string]$Periode = "",
        [int]$Jaar       = 0
    )

    $tijdstempel   = Get-Date -Format "yyyyMMdd_HHmmss"
    $outputBestand = Join-Path $script:Config.ExportPad "${RapportType}_${tijdstempel}.csv"

    $data = switch ($RapportType) {
        "Personen"    {
            Read-JsonFile $script:Config.PersonenFile | Where-Object { $_.Status -eq "actief" }
        }
        "Individueel" {
            $raw = Read-JsonFile $script:Config.IndividueelFile | Where-Object { $_.Status -eq "actief" }
            Invoke-PeriodeFilter $raw $Maand $Periode $Jaar
        }
        "Collectief"  {
            $raw = Read-JsonFile $script:Config.CollectiefFile | Where-Object { $_.Status -eq "actief" -and $null -eq $_.Module }
            Invoke-PeriodeFilter $raw $Maand $Periode $Jaar
        }
        "Fiches"      { Get-FichePerActie }
    }

    if (-not $data) {
        Write-Warning "Geen data gevonden voor rapport '$RapportType'."
        return $null
    }

    $data | ForEach-Object {
        $flat = [ordered]@{}
        foreach ($p in $_.PSObject.Properties) {
            if ($p.Value -is [array]) {
                $flat[$p.Name] = ($p.Value -join " | ")
            } else {
                $flat[$p.Name] = $p.Value
            }
        }
        [PSCustomObject]$flat
    } | Export-Csv -Path $outputBestand -NoTypeInformation -Delimiter ";" -Encoding UTF8

    Write-Host "  Export klaar: $outputBestand" -ForegroundColor Green
    return $outputBestand
}

# ==============================================================
# SECTIE 7 : IMPORT MET DUPLICATE-CONTROLE
# ==============================================================

function Import-CsvData {
    param(
        [Parameter(Mandatory)][string]$CsvPad,
        [ValidateSet("Personen","Individueel","Collectief")]
        [string]$DataType
    )

    if (-not (Test-Path $CsvPad)) {
        Write-Error "Bestand niet gevonden: $CsvPad"
        return
    }

    $nieuw   = Import-Csv $CsvPad -Delimiter ";" -Encoding UTF8
    $jsonPad = switch ($DataType) {
        "Personen"    { $script:Config.PersonenFile }
        "Individueel" { $script:Config.IndividueelFile }
        "Collectief"  { $script:Config.CollectiefFile }
    }

    $bestaande    = Read-JsonFile $jsonPad
    $bestaandeIDs = $bestaande | ForEach-Object { $_.ID }
    $nieuweRecs   = $nieuw | Where-Object { $_.ID -notin $bestaandeIDs }
    $aantalNieuw  = ($nieuweRecs | Measure-Object).Count

    if ($aantalNieuw -eq 0) {
        Write-Host "  Geen nieuwe records gevonden. Import geannuleerd." -ForegroundColor Cyan
        return
    }

    Write-Host ""
    Write-Host "  Import bevestiging" -ForegroundColor Yellow
    Write-Host "  Type       : $DataType"
    Write-Host "  Totaal CSV : $(($nieuw | Measure-Object).Count) records"
    Write-Host "  Al bekend  : $(($bestaande | Measure-Object).Count) records"
    Write-Host "  Nieuw      : $aantalNieuw records"
    $bevestiging = Read-Host "  Voeg $aantalNieuw nieuwe records toe? (j/n)"

    if ($bevestiging -ne "j") {
        Write-Host "  Import geannuleerd." -ForegroundColor Red
        return
    }

    $gecombineerd = @($bestaande) + @($nieuweRecs)
    Write-JsonFile $jsonPad $gecombineerd
    Write-Host "  $aantalNieuw records succesvol toegevoegd." -ForegroundColor Green
}

# ==============================================================
# SECTIE 8 : ARCHIEF
# ==============================================================

function Set-Gearchiveerd {
    param(
        [Parameter(Mandatory)][string]$RecordID,
        [ValidateSet("Personen","Individueel","Collectief")]
        [string]$DataType
    )

    $jsonPad = switch ($DataType) {
        "Personen"    { $script:Config.PersonenFile }
        "Individueel" { $script:Config.IndividueelFile }
        "Collectief"  { $script:Config.CollectiefFile }
    }

    $data     = Read-JsonFile $jsonPad
    $gevonden = $false

    $bijgewerkt = $data | ForEach-Object {
        if ($_.ID -eq $RecordID) {
            $gevonden = $true
            $_.Status = "gearchiveerd"
            $_ | Add-Member -NotePropertyName GearchiveerdOp `
                            -NotePropertyValue (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Force
        }
        $_
    }

    if (-not $gevonden) {
        Write-Warning "Record '$RecordID' niet gevonden."
        return
    }

    Write-JsonFile $jsonPad $bijgewerkt
    Write-Host "  Record '$RecordID' gearchiveerd." -ForegroundColor Yellow
}

function Restore-UitArchief {
    param(
        [Parameter(Mandatory)][string]$RecordID,
        [ValidateSet("Personen","Individueel","Collectief")]
        [string]$DataType
    )

    $jsonPad = switch ($DataType) {
        "Personen"    { $script:Config.PersonenFile }
        "Individueel" { $script:Config.IndividueelFile }
        "Collectief"  { $script:Config.CollectiefFile }
    }

    $data = Read-JsonFile $jsonPad
    $bijgewerkt = $data | ForEach-Object {
        if ($_.ID -eq $RecordID -and $_.Status -eq "gearchiveerd") {
            $_.Status = "actief"
        }
        $_
    }

    Write-JsonFile $jsonPad $bijgewerkt
    Write-Host "  Record '$RecordID' teruggezet naar actief." -ForegroundColor Green
}

function Remove-Definitief {
    param(
        [Parameter(Mandatory)][string]$RecordID,
        [ValidateSet("Personen","Individueel","Collectief")]
        [string]$DataType
    )

    Write-Host "  WAARSCHUWING: Dit kan niet ongedaan worden gemaakt!" -ForegroundColor Red
    $b1 = Read-Host "  Ben je zeker dat je record '$RecordID' wil wissen? (ja/nee)"
    if ($b1 -ne "ja") { Write-Host "  Wissen geannuleerd."; return }

    $b2 = Read-Host "  Bevestig: typ WISSEN"
    if ($b2 -ne "WISSEN") { Write-Host "  Wissen geannuleerd."; return }

    $jsonPad = switch ($DataType) {
        "Personen"    { $script:Config.PersonenFile }
        "Individueel" { $script:Config.IndividueelFile }
        "Collectief"  { $script:Config.CollectiefFile }
    }

    $data      = Read-JsonFile $jsonPad
    $gefilterd = $data | Where-Object { $_.ID -ne $RecordID }
    Write-JsonFile $jsonPad $gefilterd
    Write-Host "  Record '$RecordID' definitief gewist." -ForegroundColor Red
}

function Get-Archief {
    param(
        [ValidateSet("Personen","Individueel","Collectief","Alle")]
        [string]$DataType = "Alle"
    )

    $bestanden = switch ($DataType) {
        "Personen"    { @($script:Config.PersonenFile) }
        "Individueel" { @($script:Config.IndividueelFile) }
        "Collectief"  { @($script:Config.CollectiefFile) }
        "Alle"        { @($script:Config.PersonenFile, $script:Config.IndividueelFile, $script:Config.CollectiefFile) }
    }

    foreach ($bestand in $bestanden) {
        Read-JsonFile $bestand | Where-Object { $_.Status -eq "gearchiveerd" }
    }
}

# ==============================================================
# SECTIE 11 : UI HULPFUNCTIES
# ==============================================================

function Show-Header {
    param([string]$Titel)
    Clear-Host
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host "  REGISTRATIE-APP  |  $Titel"                          -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Menu {
    param(
        [string]$Titel,
        [string[]]$Opties,
        [string]$Terugoptie = "Terug"
    )
    Show-Header $Titel
    for ($i = 0; $i -lt $Opties.Count; $i++) {
        Write-Host "  [$($i+1)]  $($Opties[$i])" -ForegroundColor White
    }
    Write-Host "  [0]  $Terugoptie" -ForegroundColor DarkGray
    Write-Host ""
    $keuze = Read-Host "Keuze"
    return $keuze
}

function Lees-Tekst {
    param(
        [string]$Label,
        [bool]$Verplicht    = $false,
        [string]$Standaard  = ""
    )
    while ($true) {
        if ($Standaard -ne "") {
            $invoer = Read-Host "  $Label [$Standaard]"
        } else {
            $invoer = Read-Host "  $Label"
        }
        if ([string]::IsNullOrWhiteSpace($invoer) -and $Standaard -ne "") { return $Standaard }
        if (-not [string]::IsNullOrWhiteSpace($invoer)) { return $invoer }
        if (-not $Verplicht) { return "" }
        Write-Host "  Dit veld is verplicht." -ForegroundColor Yellow
    }
}

function Lees-Getal {
    param(
        [string]$Label,
        [int]$Min        = 0,
        [int]$Standaard  = 0
    )
    while ($true) {
        $invoer = Read-Host "  $Label [$Standaard]"
        if ([string]::IsNullOrWhiteSpace($invoer)) { return $Standaard }
        if ($invoer -match '^\d+$' -and [int]$invoer -ge $Min) { return [int]$invoer }
        Write-Host "  Geef een geldig getal in (minimum $Min)." -ForegroundColor Yellow
    }
}

function Lees-Meerkeuze {
    param(
        [string]$Label,
        [string[]]$Opties,
        [bool]$VrijeInvoer = $false
    )
    Write-Host ""
    Write-Host "  -- $Label --" -ForegroundColor Yellow
    for ($i = 0; $i -lt $Opties.Count; $i++) {
        Write-Host "    [$($i+1)] $($Opties[$i])"
    }
    if ($VrijeInvoer) { Write-Host "    [V]  Vrij invoeren" }
    Write-Host "  Selecteer nummers gescheiden door komma (bv. 1,3) of laat leeg:"
    $invoer = Read-Host "  Keuze"

    $geselecteerd = @()

    if ($VrijeInvoer -and $invoer -match '[Vv]') {
        $vrij = Read-Host "  Vrije invoer"
        if ($vrij) { $geselecteerd += $vrij }
    }

    foreach ($deel in ($invoer -split ",")) {
        $deel = $deel.Trim()
        if ($deel -match '^\d+$') {
            $idx = [int]$deel - 1
            if ($idx -ge 0 -and $idx -lt $Opties.Count) {
                $geselecteerd += $Opties[$idx]
            }
        }
    }

    return $geselecteerd
}

function Lees-EnkeleKeuze {
    param(
        [string]$Label,
        [string[]]$Opties,
        [bool]$VrijeInvoer = $false
    )
    $resultaat = Lees-Meerkeuze -Label $Label -Opties $Opties -VrijeInvoer $VrijeInvoer
    if ($resultaat.Count -gt 0) { return $resultaat[0] } else { return "" }
}

function Lees-Maand {
    $maanden = @("Januari","Februari","Maart","April","Mei","Juni",
                 "Juli","Augustus","September","Oktober","November","December")
    return Lees-EnkeleKeuze "Maand" $maanden
}

function Lees-JaNee {
    param([string]$Label)
    while ($true) {
        $ant = Read-Host "  $Label (j/n)"
        if ($ant -eq "j") { return $true }
        if ($ant -eq "n") { return $false }
        Write-Host "  Typ j voor ja of n voor nee." -ForegroundColor Yellow
    }
}

function Lees-Signalen {
    $signaalTypes = @("overlast","financien","huisvesting","juridisch","vrije tijd",
                      "fysieke gezondheid","mentale gezondheid",
                      "tewerkstelling/opleiding","verslaving","relationeel","SW+")
    $heeftSignalen = Lees-JaNee "Signalen?"
    $types = @()
    if ($heeftSignalen) {
        $types = Lees-Meerkeuze "Type signaal" $signaalTypes
    }
    return @{ Signalen = $heeftSignalen; SignaalTypes = $types }
}

function Lees-Uitgaven {
    $lijst = [System.Collections.Generic.List[object]]::new()
    Write-Host ""
    Write-Host "  -- Uitgaven (lege beschrijving = stoppen) --" -ForegroundColor Yellow
    while ($true) {
        $beschrijving = Read-Host "  Beschrijving"
        if ([string]::IsNullOrWhiteSpace($beschrijving)) { break }
        $leverancier  = Read-Host "  Leverancier"
        $bedragTxt    = Read-Host "  Bedrag"
        $bedrag       = 0
        [decimal]::TryParse(
            ($bedragTxt -replace ",", "."),
            [System.Globalization.NumberStyles]::Any,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$bedrag
        ) | Out-Null
        $lijst.Add([PSCustomObject]@{
            Beschrijving = $beschrijving
            Leverancier  = $leverancier
            Bedrag       = $bedrag
        })
        Write-Host "  Toegevoegd: $beschrijving -- $bedrag" -ForegroundColor DarkGreen
    }
    return $lijst.ToArray()
}

function Lees-Inkomsten {
    $lijst = [System.Collections.Generic.List[object]]::new()
    Write-Host ""
    Write-Host "  -- Inkomsten (lege beschrijving = stoppen) --" -ForegroundColor Yellow
    while ($true) {
        $beschrijving = Read-Host "  Beschrijving"
        if ([string]::IsNullOrWhiteSpace($beschrijving)) { break }
        $bedragTxt = Read-Host "  Bedrag"
        $bedrag    = 0
        [decimal]::TryParse(
            ($bedragTxt -replace ",", "."),
            [System.Globalization.NumberStyles]::Any,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$bedrag
        ) | Out-Null
        $lijst.Add([PSCustomObject]@{
            Beschrijving = $beschrijving
            Bedrag       = $bedrag
        })
        Write-Host "  Toegevoegd: $beschrijving -- $bedrag" -ForegroundColor DarkGreen
    }
    return $lijst.ToArray()
}

function Druk-Op-Enter {
    Write-Host ""
    Read-Host "  Druk op Enter om verder te gaan"
}

# ==============================================================
# MENU 1 : PERSOON REGISTREREN
# ==============================================================

function Menu-PersoonRegistreren {
    Show-Header "Persoon registreren"

    $voornaam    = Lees-Tekst "Voornaam"    -Verplicht $true
    $familienaam = Lees-Tekst "Familienaam" -Verplicht $true
    $adres       = Lees-Tekst "Adres"
    $postcode    = Lees-Tekst "Postcode"
    $gemeente    = Lees-Tekst "Gemeente"

    $inkomen = Lees-Meerkeuze "Inkomen" @(
        "Weet niet","Leefloon","Geen inkomen","Invaliditeit",
        "Werkloosheid","Pensioen","Arbeid","Budgetbegeleiding")

    $woonsituatie = Lees-Meerkeuze "Woonsituatie" @(
        "Dak/Thuisloos","Woont bij ouders","Huurt woning",
        "Huurt sociale woning","Heeft woning","Begeleid wonen","Weet niet")

    $gekend  = Lees-EnkeleKeuze "Gekend?" @("Al Gekend","Niet Gekend")
    $jaartal = 0
    if ($gekend -eq "Al Gekend") {
        $jaartal = Lees-Getal "Jaar van eerste contact" -Min 2000 -Standaard (Get-Date).Year
    }

    $eersteContact = Lees-Meerkeuze "Eerste contact" @("Sleutelfiguur","Vrijwilliger","Hulpvrager")
    $gekendBij     = Lees-Meerkeuze "Gekend bij"     @("MW","SHW","Woonzorg","Brugfiguur")
    $notitie       = Lees-Tekst "Notitie (optioneel)"

    $persoon = New-Persoon `
        -Voornaam $voornaam -Familienaam $familienaam `
        -Adres $adres -Postcode $postcode -Gemeente $gemeente `
        -Inkomen $inkomen -Woonsituatie $woonsituatie `
        -Gekend $gekend -GekendJaartal $jaartal `
        -EersteContact $eersteContact -GekendBij $gekendBij `
        -Notitie $notitie

    Add-ToJsonFile $script:Config.PersonenFile $persoon

    Write-Host ""
    Write-Host "  Persoon opgeslagen: $voornaam $familienaam [nr. $($persoon.Volgnummer)]" -ForegroundColor Green
    Druk-Op-Enter
}

# ==============================================================
# MENU 2 : INDIVIDUELE ACTIE LOGGEN
# ==============================================================

function Menu-IndividueleActie {
    Show-Header "Individuele actie loggen"

    $personen = Read-JsonFile $script:Config.PersonenFile | Where-Object { $_.Status -eq "actief" }
    if ($personen.Count -eq 0) {
        Write-Host "  Geen personen gevonden. Voeg eerst een persoon toe." -ForegroundColor Yellow
        Druk-Op-Enter
        return
    }

    Write-Host "  -- Persoon zoeken --" -ForegroundColor Yellow
    $zoek    = Read-Host "  Zoek op naam"
    $treffer = @($personen | Where-Object {
        "$($_.Voornaam) $($_.Familienaam)" -like "*$zoek*"
    })

    if ($treffer.Count -eq 0) {
        Write-Host "  Geen resultaten voor '$zoek'." -ForegroundColor Red
        $nieuw = Lees-JaNee "Nieuwe persoon toevoegen?"
        if ($nieuw) { Menu-PersoonRegistreren }
        return
    }

    Write-Host ""
    for ($i = 0; $i -lt $treffer.Count; $i++) {
        Write-Host "  [$($i+1)] $($treffer[$i].Voornaam) $($treffer[$i].Familienaam) [nr.$($treffer[$i].Volgnummer)]"
    }
    $keuze   = Lees-Getal "Kies persoon (nummer)" -Min 1 -Standaard 1
    $gekozen = $treffer[$keuze - 1]

    $maand = Lees-Maand

    $vindplaats = Lees-Meerkeuze "Vindplaats" @(
        "Bureau","Horeca en Handel","Publieke ruimte","Sociaal ontmoetingspunt",
        "Thuis bij gast","Thuis bij anderen","Online/Telefoon",
        "Eigen organisatie","Andere organisatie")

    $tijd = Lees-EnkeleKeuze "Tijd" @(
        "5 min","15 min","30 min","1 uur","1u30","2 uur") -VrijeInvoer $true

    $levensdomein = Lees-Meerkeuze "Levensdomein" @(
        "Financien","Juridisch","Huisvesting","Vrije tijd","Fysieke gezondheid",
        "Tewerkstelling/opleiding","Verslaving","Psychisch welzijn",
        "Relationeel","Sociaal-emotioneel","Leefomgeving","Andere")

    $methodiek = Lees-Meerkeuze "Methodiek" @(
        "Bemiddeling","Informatieverstrekking","Doorverwijzing","Begeleiding",
        "Praktische ondersteuning","Netwerk activeren",
        "Oplossingsgericht werken","Actief luisteren","Andere")

    $extraInfo = Lees-Tekst "Extra info (optioneel)"

    $toeleiding = Lees-Meerkeuze "Toeleiding" @(
        "OCMW","CAW","Justitie","Ziekenhuis","Bijzondere jeugdzorg","VDAB",
        "Sociaal-Cultureel","MSOC","Huisarts/Psycholoog","Advocaat",
        "Stadsdiensten","School","Straathoekwerk","Vrije tijd") -VrijeInvoer $true

    $actie = New-IndividueleActie `
        -Maand $maand -Volgnummer $gekozen.Volgnummer `
        -Vindplaats $vindplaats -Tijd $tijd `
        -Levensdomein $levensdomein -Methodiek $methodiek `
        -ExtraInfo $extraInfo -Toeleiding $toeleiding

    Add-ToJsonFile $script:Config.IndividueelFile $actie

    Write-Host ""
    Write-Host "  Individuele actie opgeslagen voor $($gekozen.Voornaam) $($gekozen.Familienaam)." -ForegroundColor Green
    Druk-Op-Enter
}

# ==============================================================
# MENU 3 : COLLECTIEVE ACTIE
# ==============================================================

function Menu-CollectieveActie {
    Show-Header "Collectieve actie starten"

    $maand = Lees-Maand

    $typeActie = Lees-Meerkeuze "Type actie" @(
        "Bewoners activering","Inkoop en voorbereiding","Logistieke opbouw",
        "Logistieke afbouw","Activiteit ondersteunen","Activiteit coordineren",
        "Overleg","Buurtverkenning en signalering","Presentiebezoek") -VrijeInvoer $true

    # Naam van de Actie = unieke sleutel
    Write-Host ""
    Write-Host "  -- Naam van de Actie (unieke ID) --" -ForegroundColor Yellow
    $bestaandeNamen = @(Get-BestaandeActieNamen)
    $naamVanDeActie = ""

    if ($bestaandeNamen.Count -gt 0) {
        Write-Host "  Bestaande namen:"
        for ($i = 0; $i -lt $bestaandeNamen.Count; $i++) {
            Write-Host "    [$($i+1)] $($bestaandeNamen[$i])"
        }
        Write-Host "    [N]  Nieuwe naam invoeren"
        Write-Host ""
        $keuze = Read-Host "  Keuze"

        if ($keuze -match '^[Nn]$') {
            $naamVanDeActie = Lees-Tekst "Nieuwe naam" -Verplicht $true
        } elseif ($keuze -match '^\d+$') {
            $idx = [int]$keuze - 1
            if ($idx -ge 0 -and $idx -lt $bestaandeNamen.Count) {
                $naamVanDeActie = $bestaandeNamen[$idx]
            }
        }
    } else {
        $naamVanDeActie = Lees-Tekst "Naam van de actie (nieuw)" -Verplicht $true
    }

    if ([string]::IsNullOrWhiteSpace($naamVanDeActie)) {
        Write-Host "  Geen geldige naam. Actie geannuleerd." -ForegroundColor Red
        Druk-Op-Enter
        return
    }

    $duur = Lees-EnkeleKeuze "Duur" @(
        "15 min","30 min","45 min","1 uur","1u30","2 uur","3 uur","4 uur") -VrijeInvoer $true

    $cluster = Lees-Meerkeuze "Cluster" @(
        "Deelnemer/partner van georganiseerde ontmoeting","Deur aan deur",
        "Huisbezoek","Overleg/afstemming partner","Presentie",
        "Trekker/facilitator van georganiseerde ontmoeting","Andere")

    $thema = Lees-Meerkeuze "Thema" @(
        "Communicatie","Diversiteit","Financieel/inkomen","Gezondheid",
        "Huiswerkbegeleiding","Inschrijving","Ontmoeting","Opleiding",
        "Praktisch","Psychosociaal","Vrije tijd","Andere") -VrijeInvoer $true

    Write-Host ""
    Write-Host "  -- Bereikte personen --" -ForegroundColor Yellow
    $aantalBewoners      = Lees-Getal "Aantal bewoners"
    $waarvanNieuw        = Lees-Getal "Waarvan nieuwe bewoners"
    $aantalVrijwilligers = Lees-Getal "Aantal vrijwilligers"

    $namenVrijwilligers = @()
    if ($aantalVrijwilligers -gt 0) {
        Write-Host "  Namen vrijwilligers (lege invoer = stoppen):" -ForegroundColor Yellow
        $bekendVrijw = @(Read-JsonFile $script:Config.CollectiefFile |
                       Where-Object { $null -ne $_.NaamVrijwilligers } |
                       ForEach-Object { $_.NaamVrijwilligers } |
                       Select-Object -Unique | Sort-Object)
        if ($bekendVrijw.Count -gt 0) {
            Write-Host "  Bekende namen: $($bekendVrijw -join ', ')" -ForegroundColor DarkGray
        }
        for ($v = 1; $v -le $aantalVrijwilligers; $v++) {
            $nm = Read-Host "  Naam vrijwilliger $v"
            if ([string]::IsNullOrWhiteSpace($nm)) { break }
            $namenVrijwilligers += $nm
        }
    }

    $naamPartner = Lees-Tekst "Naam partner (optioneel)"

    $actie = New-CollectieveActie `
        -Maand $maand -NaamVanDeActie $naamVanDeActie `
        -TypeActie $typeActie -Duur $duur -Cluster $cluster -Thema $thema `
        -AantalBewoners $aantalBewoners -WaarvanNieuweBewoners $waarvanNieuw `
        -AantalVrijwilligers $aantalVrijwilligers -NaamVrijwilligers $namenVrijwilligers `
        -NaamPartner $naamPartner

    Add-ToJsonFile $script:Config.CollectiefFile $actie

    Write-Host ""
    Write-Host "  Collectieve actie opgeslagen: '$naamVanDeActie'" -ForegroundColor Green
    Write-Host ""

    Menu-VervolgModules -NaamVanDeActie $naamVanDeActie
}

function Menu-VervolgModules {
    param([string]$NaamVanDeActie)

    while ($true) {
        Show-Header "Vervolg: '$NaamVanDeActie'"
        Write-Host "  Wil je nu een module toevoegen voor deze actie?" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [1]  Logistiek en Follow-up"
        Write-Host "  [2]  Overleg"
        Write-Host "  [3]  Activiteit"
        Write-Host "  [4]  Fiche bekijken"
        Write-Host "  [0]  Terug naar hoofdmenu"
        Write-Host ""
        $keuze = Read-Host "  Keuze"

        switch ($keuze) {
            "1" { Menu-Logistiek  -NaamVanDeActie $NaamVanDeActie }
            "2" { Menu-Overleg    -NaamVanDeActie $NaamVanDeActie }
            "3" { Menu-Activiteit -NaamVanDeActie $NaamVanDeActie }
            "4" {
                $fiche = Get-FichePerActie -NaamFilter $NaamVanDeActie
                Show-Header "Fiche: $NaamVanDeActie"
                $fiche | Format-List
                Druk-Op-Enter
            }
            "0" { return }
            default {
                Write-Host "  Ongeldige keuze." -ForegroundColor Yellow
                Start-Sleep 1
            }
        }
    }
}

function Menu-Logistiek {
    param([string]$NaamVanDeActie)
    Show-Header "Logistiek en Follow-up -- '$NaamVanDeActie'"

    $datum      = Lees-Tekst "Datum (bv. 2024-03-15)" -Standaard (Get-Date -Format "yyyy-MM-dd")
    $uitlegType = Lees-Meerkeuze "Uitleg type" @(
        "flyeren","boodschappen","materiaal ophalen","materiaal terugbrengen",
        "stockbeheer buurthuis","opkuis","ondersteunen vrijwilliger")

    $uitgaven = Lees-Uitgaven
    $signalen = Lees-Signalen
    $notitie  = Lees-Tekst "Notitie (optioneel)"

    $record = New-LogistiekRecord `
        -NaamVanDeActie $NaamVanDeActie -Datum $datum `
        -UitlegType $uitlegType -Uitgaven $uitgaven `
        -Signalen $signalen.Signalen -SignaalTypes $signalen.SignaalTypes `
        -Notitie $notitie

    Add-ToJsonFile $script:Config.CollectiefFile $record
    Write-Host ""
    Write-Host "  Logistiek record opgeslagen." -ForegroundColor Green
    Druk-Op-Enter
}

function Menu-Overleg {
    param([string]$NaamVanDeActie)
    Show-Header "Overleg -- '$NaamVanDeActie'"

    $datum    = Lees-Tekst "Datum" -Standaard (Get-Date -Format "yyyy-MM-dd")
    $signalen = Lees-Signalen
    $notitie  = Lees-Tekst "Notitie (optioneel)"

    $record = New-OverlegRecord `
        -NaamVanDeActie $NaamVanDeActie -Datum $datum `
        -Signalen $signalen.Signalen -SignaalTypes $signalen.SignaalTypes `
        -Notitie $notitie

    Add-ToJsonFile $script:Config.CollectiefFile $record
    Write-Host ""
    Write-Host "  Overleg record opgeslagen." -ForegroundColor Green
    Druk-Op-Enter
}

function Menu-Activiteit {
    param([string]$NaamVanDeActie)
    Show-Header "Activiteit -- '$NaamVanDeActie'"

    $locatie = Lees-EnkeleKeuze "Locatie" @(
        "Buurthuis","Parking Karting","Gentsesteenweg","Vaart",
        "Loodwitstraat","Stasegemsesteenweg","Juweliersplein",
        "Zandbergstraat") -VrijeInvoer $true

    $type = Lees-EnkeleKeuze "Type" @("Buurtactiviteit","Buurtwerk")

    Write-Host ""
    Write-Host "  -- Financieel --" -ForegroundColor Yellow
    $uitgaven  = Lees-Uitgaven
    $inkomsten = Lees-Inkomsten

    $participatie = Lees-Meerkeuze "Participatie" @(
        "Kijken","Deelnemen","Feedback geven","Advies geven",
        "Meedenken","Mee organiseren","Helpen","Trekken")

    $doel = Lees-Meerkeuze "Doel" @(
        "Sociale doelen","Individuele doelen",
        "Ontwikkelingsgerichte doelen","Activerende doelen","Organisatorische doelen")

    # Impact afhankelijk van gekozen doelen
    $impactOpties = [System.Collections.Generic.List[string]]::new()
    if ($doel -contains "Sociale doelen") {
        $impactOpties.Add("nieuwe contacten gelegd")
        $impactOpties.Add("sterkere buurtbanden")
        $impactOpties.Add("meer vertrouwen tussen bewoners")
        $impactOpties.Add("verminderd isolement")
    }
    if ($doel -contains "Individuele doelen") {
        $impactOpties.Add("verhoogd zelfvertrouwen")
        $impactOpties.Add("vaker initiatief nemen")
        $impactOpties.Add("verbeterd mentaal en sociaal welzijn")
    }
    if ($doel -contains "Ontwikkelingsgerichte doelen") {
        $impactOpties.Add("taal")
        $impactOpties.Add("digitaal")
        $impactOpties.Add("vaardigheden")
    }
    if ($doel -contains "Activerende doelen") {
        $impactOpties.Add("mee organiseren")
        $impactOpties.Add("stijgende deelname aan activiteiten")
        $impactOpties.Add("doorstroom opleiding of werk")
        $impactOpties.Add("vrijwilligersengagement")
    }
    if ($doel -contains "Organisatorische doelen") {
        $impactOpties.Add("nieuwe doelgroepen")
        $impactOpties.Add("verhoogde zichtbaarheid")
        $impactOpties.Add("vertrouwen bevorderen in werking/organisatie")
        $impactOpties.Add("signalen")
        $impactOpties.Add("preventie")
    }

    $impact = @()
    if ($impactOpties.Count -gt 0) {
        $impact = Lees-Meerkeuze "Impact" ($impactOpties | Select-Object -Unique)
    }

    $signalen = Lees-Signalen
    $notitie  = Lees-Tekst "Notitie (optioneel)"

    $record = New-ActiviteitRecord `
        -NaamVanDeActie $NaamVanDeActie -Locatie $locatie -Type $type `
        -Uitgaven $uitgaven -Inkomsten $inkomsten `
        -Participatie $participatie -Doel $doel -Impact $impact `
        -Signalen $signalen.Signalen -SignaalTypes $signalen.SignaalTypes `
        -Notitie $notitie

    Add-ToJsonFile $script:Config.CollectiefFile $record
    Write-Host ""
    Write-Host "  Activiteit record opgeslagen." -ForegroundColor Green
    Druk-Op-Enter
}

# ==============================================================
# MENU 4 : RAPPORTEN & FICHES
# ==============================================================

function Menu-Rapporten {
    while ($true) {
        $keuze = Show-Menu "Rapporten en Fiches" @(
            "Alle personen tonen"
            "Individuele acties (filter op periode)"
            "Collectieve acties (gegroepeerd per naam)"
            "Fiche bekijken per actienaam"
            "Exporteer rapport naar CSV"
        )

        switch ($keuze) {
            "1" {
                Show-Header "Personen"
                Read-JsonFile $script:Config.PersonenFile |
                    Where-Object { $_.Status -eq "actief" } |
                    Format-Table Volgnummer,Voornaam,Familienaam,Gemeente -AutoSize
                Druk-Op-Enter
            }
            "2" {
                Show-Header "Individuele acties"
                $jaar  = Lees-Getal "Jaar (0 = alle)" -Standaard 0
                $maand = Lees-Tekst "Maand (leeg = alle)"
                $data  = Invoke-PeriodeFilter (
                    Read-JsonFile $script:Config.IndividueelFile |
                    Where-Object { $_.Status -eq "actief" }
                ) $maand "" $jaar
                $data | Format-Table Datum,Maand,Jaar,PersoonNummer,Tijd -AutoSize
                Druk-Op-Enter
            }
            "3" {
                Show-Header "Collectieve acties per naam"
                $groeped = Get-CollectiefGroepeerdPerNaam
                foreach ($g in $groeped) {
                    Write-Host "  $($g.Name) ($($g.Count) registraties)" -ForegroundColor Cyan
                }
                Druk-Op-Enter
            }
            "4" {
                Show-Header "Fiche opvragen"
                $namen = @(Get-BestaandeActieNamen)
                if ($namen.Count -eq 0) {
                    Write-Host "  Nog geen collectieve acties geregistreerd." -ForegroundColor Yellow
                    Druk-Op-Enter
                    continue
                }
                for ($i = 0; $i -lt $namen.Count; $i++) {
                    Write-Host "  [$($i+1)] $($namen[$i])"
                }
                $kNaam = Lees-Getal "Kies actie" -Min 1 -Standaard 1
                $fiche = Get-FichePerActie -NaamFilter $namen[$kNaam - 1]
                Show-Header "Fiche: $($namen[$kNaam - 1])"
                $fiche | Format-List
                Druk-Op-Enter
            }
            "5" {
                Show-Header "Exporteer naar CSV"
                $typeNamen = @("Personen","Individueel","Collectief","Fiches")
                for ($i = 0; $i -lt $typeNamen.Count; $i++) {
                    Write-Host "  [$($i+1)] $($typeNamen[$i])"
                }
                $tk = Lees-Getal "Kies rapport" -Min 1 -Standaard 1
                $gekozenType = $typeNamen[$tk - 1]
                $pad = Export-ToExcel -RapportType $gekozenType
                if ($pad) { Write-Host "  Bestand: $pad" -ForegroundColor Green }
                Druk-Op-Enter
            }
            "0" { return }
            default {
                Write-Host "  Ongeldige keuze." -ForegroundColor Yellow
                Start-Sleep 1
            }
        }
    }
}

# ==============================================================
# MENU 5 : BEHEER
# ==============================================================

function Menu-Beheer {
    while ($true) {
        $keuze = Show-Menu "Beheer" @(
            "Archief bekijken"
            "Record archiveren"
            "Record herstellen uit archief"
            "Record definitief wissen"
            "CSV importeren (enkel nieuwe data)"
            "Back-up maken (alle data naar CSV)"
            "ALLE data wissen"
        )

        switch ($keuze) {
            "1" {
                Show-Header "Archief"
                $archief = @(Get-Archief)
                if ($archief.Count -eq 0) {
                    Write-Host "  Archief is leeg." -ForegroundColor Cyan
                } else {
                    $archief | Format-Table ID,NaamVanDeActie,Status,GearchiveerdOp -AutoSize
                }
                Druk-Op-Enter
            }
            "2" {
                Show-Header "Record archiveren"
                $id   = Lees-Tekst "Record ID"
                $type = Lees-EnkeleKeuze "Type" @("Personen","Individueel","Collectief")
                Set-Gearchiveerd -RecordID $id -DataType $type
                Druk-Op-Enter
            }
            "3" {
                Show-Header "Herstellen uit archief"
                $id   = Lees-Tekst "Record ID"
                $type = Lees-EnkeleKeuze "Type" @("Personen","Individueel","Collectief")
                Restore-UitArchief -RecordID $id -DataType $type
                Druk-Op-Enter
            }
            "4" {
                Show-Header "Definitief wissen"
                $id   = Lees-Tekst "Record ID"
                $type = Lees-EnkeleKeuze "Type" @("Personen","Individueel","Collectief")
                Remove-Definitief -RecordID $id -DataType $type
                Druk-Op-Enter
            }
            "5" {
                Show-Header "CSV importeren"
                $pad  = Lees-Tekst "Pad naar CSV-bestand" -Verplicht $true
                $type = Lees-EnkeleKeuze "Type data" @("Personen","Individueel","Collectief")
                Import-CsvData -CsvPad $pad -DataType $type
                Druk-Op-Enter
            }
            "6" {
                Show-Header "Back-up maken"
                foreach ($type in @("Personen","Individueel","Collectief","Fiches")) {
                    Export-ToExcel -RapportType $type | Out-Null
                }
                Write-Host "  Back-up klaar in: $($script:Config.ExportPad)" -ForegroundColor Green
                Druk-Op-Enter
            }
            "7" {
                Show-Header "ALLE DATA WISSEN"
                Write-Host "  Dit wist ALLE personen, acties en logs definitief!" -ForegroundColor Red
                $b1 = Read-Host "  Ben je zeker? (ja/nee)"
                if ($b1 -ne "ja") {
                    Write-Host "  Geannuleerd."
                    Druk-Op-Enter
                    continue
                }
                $b2 = Read-Host "  Typ ALLES WISSEN ter bevestiging"
                if ($b2 -ne "ALLES WISSEN") {
                    Write-Host "  Geannuleerd."
                    Druk-Op-Enter
                    continue
                }
                foreach ($pad in @(
                    $script:Config.PersonenFile,
                    $script:Config.IndividueelFile,
                    $script:Config.CollectiefFile
                )) {
                    if (Test-Path $pad) { Remove-Item $pad -Force }
                }
                Write-Host "  Alle data gewist." -ForegroundColor Red
                Druk-Op-Enter
            }
            "0" { return }
            default {
                Write-Host "  Ongeldige keuze." -ForegroundColor Yellow
                Start-Sleep 1
            }
        }
    }
}

# ==============================================================
# HOOFDMENU
# ==============================================================

function Start-RegistratieApp {
    while ($true) {
        Show-Header "Hoofdmenu"
        Write-Host "  [1]  Persoon registreren"             -ForegroundColor White
        Write-Host "  [2]  Individuele actie loggen"        -ForegroundColor White
        Write-Host "  [3]  Collectieve actie starten"       -ForegroundColor White
        Write-Host "  [4]  Rapport of fiche bekijken"       -ForegroundColor White
        Write-Host "  [5]  Beheer (archief/import/export)"  -ForegroundColor White
        Write-Host "  [0]  Afsluiten"                       -ForegroundColor DarkGray
        Write-Host ""
        $keuze = Read-Host "  Keuze"

        switch ($keuze) {
            "1" { Menu-PersoonRegistreren }
            "2" { Menu-IndividueleActie }
            "3" { Menu-CollectieveActie }
            "4" { Menu-Rapporten }
            "5" { Menu-Beheer }
            "0" {
                Write-Host ""
                Write-Host "  Tot ziens!" -ForegroundColor Cyan
                Write-Host ""
                return
            }
            default {
                Write-Host "  Ongeldige keuze, probeer opnieuw." -ForegroundColor Yellow
                Start-Sleep 1
            }
        }
    }
}

# ==============================================================
# START
# ==============================================================
Start-RegistratieApp

