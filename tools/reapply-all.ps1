# Re-applies all Swagger/DTO code updates + regenerates the Postman collection
# after any git pull/reset. Safe to run repeatedly.
$ErrorActionPreference = 'Stop'
$root = 'C:\New folder\hmc-project'

Write-Host '1) Applying backend Swagger/DTO code patch...'
Push-Location $root
git apply --3way "$root\tools\backend-code-updates.patch" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host '   patch did not apply cleanly (maybe already applied) - checking...'
  git apply --check --reverse "$root\tools\backend-code-updates.patch" 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Host '   already applied. OK.' }
  else { Write-Warning '   NEEDS MANUAL REVIEW: git apply --reject "tools\backend-code-updates.patch"' }
}
Pop-Location

Write-Host '2) Rebuilding the Postman collection (fixes + real examples)...'
node "$root\tools\update-collection.js"

Write-Host '3) Verifying...'
node "$root\tools\verify-collection.js"

Write-Host '4) Typecheck backend...'
Push-Location "$root\HMC_BackEnd"
npm.cmd run build
Pop-Location

Write-Host 'DONE.'
