docker run -d --name dd-agent `
  -e DD_API_KEY=e05d51ed427ff5e82c4fdf6b4dc2ad06 `
  -e DD_SITE="us5.datadoghq.com" `
  -e DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true `
  gcr.io/datadoghq/agent:7

Write-Host "DataDog agent started. Checking status..."
Start-Sleep -Seconds 3
docker ps | Select-String dd-agent
Write-Host "`nViewing logs (Ctrl+C to stop)..."
docker logs -f dd-agent

