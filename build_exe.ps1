# Build Script for Special Education Schedule System
# Usage: ./build_exe.ps1

Write-Host "Building SpecialEdSchedule.exe..."

# Clean previous build
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "SpecialEdSchedule.spec") { Remove-Item -Force "SpecialEdSchedule.spec" }

# Run PyInstaller
# --onefile: Bundle into a single exe
# --noconsole: Hide the black terminal window (Wait! User instructions said "keep black terminal open" for save safety. maybe keep it visible for now? User said "keep black terminal window open" in SETUP.md, implying they expect it. But for a polished exe, maybe hiding it is better?
# Actually, hiding it means if it crashes, no logs. Let's keep console for now as it's safer for debugging, or ask user.
# Given the user context "share with others", a console window might be confusing but safe. 
# However, for "app-like" experience, --noconsole is better. 
# I will use --console (default) for now so they can see "Server running at..." text, otherwise they won't know it started. 
# Wait, if --noconsole, where do they see the URL?
# Ah, if --noconsole, they need to know to open localhost:3000 manually? Or auto-open browser?
# I'll add auto-open browser to `app.py` if I go --noconsole options.
# For this iteration, let's keep the console so the IP address message I just added is visible.

py -m PyInstaller --name "SpecialEdSchedule" --onefile --clean `
    --add-data "index.html;." `
    --add-data "index.css;." `
    --add-data "script.js;." `
    app.py

Write-Host "Build complete. Executable is in dist/SpecialEdSchedule.exe"
