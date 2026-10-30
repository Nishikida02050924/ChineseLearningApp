$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$framesDir = Join-Path $projectDir 'docs\demo\frames-ready'
$sourceDir = Join-Path $projectDir 'docs\demo'
$publicDir = Join-Path $projectDir 'public\demo'
$pptxPath = Join-Path $sourceDir 'chaitan-demo-source.pptx'
$videoPath = Join-Path $publicDir 'chaitan-demo.mp4'
New-Item -ItemType Directory -Force -Path $sourceDir, $publicDir | Out-Null

function Get-OfficeColor([int]$red, [int]$green, [int]$blue) {
  return $red + ($green * 256) + ($blue * 65536)
}

$scenes = @(
  @{ File = 'home.png'; Title = '中国語学習アプリ「チャイ単」'; Subtitle = '日常会話から、少しずつ。' },
  @{ File = 'verbs.png'; Title = 'よく使う動詞に絞り込み'; Subtitle = '覚えたい単語がすぐ見つかる' },
  @{ File = 'negative.png'; Title = '自然な否定文も一緒に'; Subtitle = '肯定文と比べながら覚えられる' },
  @{ File = 'phrase.png'; Title = 'フレーズは具体例つき'; Subtitle = 'タップして例文と中国語音声を確認' },
  @{ File = 'account-status.png'; Title = 'プロフィールはすっきり表示'; Subtitle = '普段は必要な情報だけ' },
  @{ File = 'account-edit.png'; Title = '鉛筆から必要なときだけ編集'; Subtitle = '画像・名前・ピンイン・速度をまとめて設定' }
)

$powerPoint = New-Object -ComObject PowerPoint.Application
$presentation = $null
try {
  $powerPoint.Visible = -1
  $presentation = $powerPoint.Presentations.Add()
  $presentation.PageSetup.SlideWidth = 540
  $presentation.PageSetup.SlideHeight = 960

  for ($index = 0; $index -lt $scenes.Count; $index++) {
    $scene = $scenes[$index]
    $slide = $presentation.Slides.Add($index + 1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.ForeColor.RGB = Get-OfficeColor 247 250 246

    $title = $slide.Shapes.AddTextbox(1, 28, 24, 484, 40)
    $title.TextFrame.TextRange.Text = $scene.Title
    $title.TextFrame.TextRange.Font.Name = 'Yu Gothic UI'
    $title.TextFrame.TextRange.Font.Size = 22
    $title.TextFrame.TextRange.Font.Bold = -1
    $title.TextFrame.TextRange.Font.Color.RGB = Get-OfficeColor 31 78 65
    $title.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    $subtitle = $slide.Shapes.AddTextbox(1, 28, 65, 484, 28)
    $subtitle.TextFrame.TextRange.Text = $scene.Subtitle
    $subtitle.TextFrame.TextRange.Font.Name = 'Yu Gothic UI'
    $subtitle.TextFrame.TextRange.Font.Size = 11
    $subtitle.TextFrame.TextRange.Font.Color.RGB = Get-OfficeColor 87 112 102
    $subtitle.TextFrame.TextRange.ParagraphFormat.Alignment = 2

    $framePath = Join-Path $framesDir $scene.File
    if (-not (Test-Path -LiteralPath $framePath)) { throw "画面画像がありません: $framePath" }
    $picture = $slide.Shapes.AddPicture($framePath, 0, -1, 85, 105, 370, 800)
    $picture.Line.Visible = -1
    $picture.Line.ForeColor.RGB = Get-OfficeColor 215 225 218
    $picture.Line.Weight = 1
    $picture.Shadow.Visible = -1
    $picture.Shadow.Blur = 8
    $picture.Shadow.Transparency = 0.7
    $picture.Shadow.OffsetX = 0
    $picture.Shadow.OffsetY = 3

    $slide.SlideShowTransition.AdvanceOnTime = -1
    $slide.SlideShowTransition.AdvanceTime = 3
  }

  $presentation.SaveAs($pptxPath, 24)
  if (Test-Path -LiteralPath $videoPath) { Remove-Item -LiteralPath $videoPath -Force }
  $presentation.CreateVideo($videoPath, $true, 3, 1080, 30, 90)

  $deadline = (Get-Date).AddMinutes(4)
  while ($presentation.CreateVideoStatus -in 1, 4) {
    if ((Get-Date) -gt $deadline) { throw '動画の書き出しが時間内に完了しませんでした。' }
    Start-Sleep -Seconds 2
  }
  if ($presentation.CreateVideoStatus -ne 2 -or -not (Test-Path -LiteralPath $videoPath)) {
    throw "動画の書き出しに失敗しました。状態: $($presentation.CreateVideoStatus)"
  }
  $lastLength = -1
  $stableChecks = 0
  while ($stableChecks -lt 3) {
    Start-Sleep -Seconds 2
    $currentLength = (Get-Item -LiteralPath $videoPath).Length
    if ($currentLength -eq $lastLength -and $currentLength -gt 0) { $stableChecks++ }
    else { $stableChecks = 0 }
    $lastLength = $currentLength
  }
  Write-Output "$videoPath ($lastLength bytes)"
}
finally {
  if ($presentation) { $presentation.Close() }
  $powerPoint.Quit()
  if ($presentation) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint)
}
