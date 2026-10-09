param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '../public/downloads/Portfolio_Resume.docx'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '../public/downloads/Portfolio_Resume.pdf')
)

$ErrorActionPreference = 'Stop'
$sourceAbsolutePath = (Resolve-Path -LiteralPath $SourcePath).Path
$outputAbsolutePath = [System.IO.Path]::GetFullPath($OutputPath)
if ([System.IO.Path]::GetExtension($sourceAbsolutePath) -ne '.docx' -or
    [System.IO.Path]::GetExtension($outputAbsolutePath) -ne '.pdf') {
    throw 'Supply a DOCX source and a PDF output path.'
}

$sourceHash = (Get-FileHash -LiteralPath $sourceAbsolutePath -Algorithm SHA256).Hash
$wordApplication = $null
$wordDocument = $null
$ownsApplication = $false
try {
    # Use a fresh automation instance, with no user documents open in it.
    $wordApplication = New-Object -ComObject Word.Application
    if ($wordApplication.Documents.Count -ne 0) {
        throw 'Word did not provide an empty automation instance.'
    }
    $ownsApplication = $true
    $wordApplication.Visible = $false
    $wordApplication.DisplayAlerts = 0
    $wordApplication.AutomationSecurity = 3
    $wordDocument = $wordApplication.Documents.Open($sourceAbsolutePath, $false, $true, $false)

    # PDF print quality, all pages, content only, heading bookmarks and document tags.
    $wordDocument.ExportAsFixedFormat($outputAbsolutePath, 17, $false, 0, 0, 1, 1, 0, $true, $true, 1, $true, $true, $false)
}
finally {
    if ($null -ne $wordDocument) {
        $wordDocument.Close(0)
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordDocument)
    }
    if ($null -ne $wordApplication) {
        if ($ownsApplication) { $wordApplication.Quit(0) }
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApplication)
    }
}

if ((Get-FileHash -LiteralPath $sourceAbsolutePath -Algorithm SHA256).Hash -ne $sourceHash) {
    throw 'The source DOCX changed during export.'
}
Get-Item -LiteralPath $outputAbsolutePath | Select-Object FullName, Length
