# Lossless post-export packaging. No geometry/texture compression or runtime codec.
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$modelRoot = Join-Path $taskRoot 'public/assets/world/shared/models'
$temporaryRoot = Join-Path $taskRoot 'authoring/generated/fallen-keep-optimized'
New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
foreach ($asset in Get-ChildItem -LiteralPath $modelRoot -Filter 'fallen-keep-*.glb') {
    $temporaryFile = Join-Path $temporaryRoot $asset.Name
    & npm exec --yes --package=@gltf-transform/cli@4.3.0 -- gltf-transform dedup $asset.FullName $temporaryFile
    if ($LASTEXITCODE -ne 0) { throw "Deduplication failed for $($asset.Name)" }
    & npm exec --yes --package=@gltf-transform/cli@4.3.0 -- gltf-transform prune $temporaryFile $asset.FullName
    if ($LASTEXITCODE -ne 0) { throw "Pruning failed for $($asset.Name)" }
}
