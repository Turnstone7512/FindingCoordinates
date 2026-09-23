@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "REPO_DIR=E:\Programs\GitHub\FindingCoordinates"
set "VERSION=20260923-0001"
set "CHANGE_SUMMARY_B64=5bu66L+u5Lqk5rW35qCE5ZyL5q2j6Lqr6auY6auU6YeN5ZWP5a6a5oC75qCE5ZyL"
set "COMMIT_MSG_FILE=%TEMP%\finding-coordinates-commit-message.txt"

cd /d "%REPO_DIR%"
if errorlevel 1 (
  echo Cannot open repo directory: %REPO_DIR%
  pause
  exit /b 1
)

git -C "%REPO_DIR%" status

git -C "%REPO_DIR%" add -A

git -C "%REPO_DIR%" diff --cached --quiet
if %errorlevel%==0 (
  echo No changes to commit.
  pause
  exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$summary=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:CHANGE_SUMMARY_B64)); $message=$env:VERSION + ' - ' + $summary; [IO.File]::WriteAllText($env:COMMIT_MSG_FILE, $message, (New-Object Text.UTF8Encoding $false)); Write-Host ('Commit message: ' + $message)"
if errorlevel 1 (
  echo Failed to prepare commit message.
  pause
  exit /b 1
)

git -C "%REPO_DIR%" commit -F "%COMMIT_MSG_FILE%"
if errorlevel 1 (
  echo Commit failed.
  pause
  exit /b 1
)

git -C "%REPO_DIR%" push origin main
if errorlevel 1 (
  echo Push failed.
  pause
  exit /b 1
)

echo Push completed.
pause