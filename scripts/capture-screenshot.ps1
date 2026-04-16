$ErrorActionPreference = 'Stop'

$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputPath = Join-Path $projectDir 'assets/balconx-real.png'
$command = "cd /d `"$projectDir`" && bun run src/index.ts"

$wt = Start-Process wt -ArgumentList @('new-tab', 'cmd', '/k', $command) -PassThru
Start-Sleep -Seconds 5

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32Capture {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  public const uint WM_CLOSE = 0x0010;
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@

Add-Type -AssemblyName System.Drawing

$foundHwnd = [IntPtr]::Zero
$foundTitle = ''

for ($i = 0; $i -lt 30 -and $foundHwnd -eq [IntPtr]::Zero; $i++) {
  [Win32Capture]::EnumWindows({
    param($hWnd, $lParam)
    if (-not [Win32Capture]::IsWindowVisible($hWnd)) { return $true }
    $sb = New-Object System.Text.StringBuilder 512
    [void][Win32Capture]::GetWindowText($hWnd, $sb, $sb.Capacity)
    $title = $sb.ToString()
    if ($title -like '*balconx*') {
      $script:foundHwnd = $hWnd
      $script:foundTitle = $title
      return $false
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  if ($foundHwnd -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 500 }
}

if ($foundHwnd -eq [IntPtr]::Zero) {
  Stop-Process -Id $wt.Id -Force -ErrorAction SilentlyContinue
  throw 'Could not find a balconx window to capture.'
}

$rect = New-Object Win32Capture+RECT
[void][Win32Capture]::GetWindowRect($foundHwnd, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

[void][Win32Capture]::PostMessage($foundHwnd, [Win32Capture]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Seconds 1
Stop-Process -Id $wt.Id -Force -ErrorAction SilentlyContinue

Write-Host "Captured: $outputPath"
Write-Host "Window title: $foundTitle"
