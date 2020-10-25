Install-WindowsFeature -name Web-Server -IncludeManagementTools

powershell.exe -Command Set-ExecutionPolicy RemoteSigned
powershell.exe -Command Import-Module AWSPowerShell
powershell.exe -Command New-Item -Path "c:\temp" -ItemType "directory" -Force
Write-Host ("Adding Windows Defender exclude for CodeDeploy...")
powershell.exe -Command Add-MpPreference -ExclusionPath ("C:\temp")
powershell.exe -Command Read-S3Object -BucketName basic-index-page-application-bucket -Key deployment/codedeploy-agent.msi -File c:\temp\codedeploy-agent.msi
powershell.exe -Command c:\temp\codedeploy-agent.msi /quiet /l c:\temp\host-agent-install-log.txt
