@echo off
SET "PROJECT_DIR=%~dp0"
SET "GEMINI_COMMAND=gemini.cmd"

REM Check if wt.exe exists, it's usually in %LOCALAPPDATA%\Microsoft\WindowsApps\
WHERE wt.exe >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO Windows Terminal (wt.exe) not found in PATH. Please install it or add its path.
    PAUSE
    EXIT /B 1
)

ECHO Opening Windows Terminal in "%PROJECT_DIR%" and launching Gemini...
start "" wt.exe -d "%PROJECT_DIR%" --title "Gemini Agent - TampermonkeyScripts" %GEMINI_COMMAND%

