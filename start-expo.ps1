# Stop any running Expo/Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Navigate to project directory
Set-Location "c:\Users\Asus\Downloads\manuverpro-main (1)\manuverpro-main"

# Clear Expo cache
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue

# Start Expo with tunnel mode (works better for iPhone)
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Starting Expo Development Server..." -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

.\node_modules\.bin\expo start --clear --tunnel ngrok

# Alternative if above fails:
# npm start -- --tunnel
