@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0.."
if errorlevel 1 goto failed
where git >nul 2>nul
if errorlevel 1 goto failed
git rev-parse --show-toplevel
if errorlevel 1 goto failed
set "BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH goto failed
echo Uploading branch: %BRANCH%
git remote get-url origin
if errorlevel 1 goto failed
git status --short
git add -A
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 2 goto failed
if errorlevel 1 goto commit
echo No new changes. Pushing any existing local commits.
goto push
:commit
git commit -m "Update FindingCoordinates"
if errorlevel 1 goto failed
:push
git push -u origin "%BRANCH%"
if errorlevel 1 goto failed
echo Push completed. On GitHub, select branch: %BRANCH%
echo The upload script is inside the BAT folder.
echo Website publication is separate from uploading repository files.
pause
exit /b 0
:failed
echo Upload failed. Please read the error above. Your local files are preserved.
pause
exit /b 1
