param([string]$out, [double]$l=0.648, [double]$t=0.066, [double]$r=0.866, [double]$b=0.895)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WinU {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int s);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
'@
$p = Get-Process wechatdevtools -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Error "no IDE window"; exit 1 }
[WinU]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
[WinU]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 400
$rc = New-Object WinU+RECT
[WinU]::GetWindowRect($p.MainWindowHandle, [ref]$rc) | Out-Null
$w = $rc.Right - $rc.Left; $h = $rc.Bottom - $rc.Top
$x = [int]($rc.Left + $w * $l); $y = [int]($rc.Top + $h * $t)
$cw = [int]($w * ($r - $l)); $ch = [int]($h * ($b - $t))
$bmp = New-Object System.Drawing.Bitmap $cw, $ch
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved $out ($cw x $ch)"
