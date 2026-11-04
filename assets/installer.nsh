; Somente os pontos específicos da AcessaNet. Instalação, remoção e --updated
; permanecem no template NSIS padrão do electron-builder.
!include "LogicLib.nsh"
; Manter as chaves já utilizadas evita duas entradas de desinstalação.
!define INSTALL_REGISTRY_KEY "Software\AcessaWorkspace"
!define UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace"

!macro preInit
  ; O instalador antigo gravava InstallDir. O padrão lê InstallLocation.
  SetRegView 32
  ReadRegStr $0 HKCU "Software\AcessaWorkspace" "InstallDir"
  SetRegView 64
  ${If} $0 == ""
    ReadRegStr $0 HKCU "Software\AcessaWorkspace" "InstallDir"
  ${EndIf}
  ReadRegStr $1 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $1 == ""
  ${AndIf} $0 != ""
    ; Ignorar entradas órfãs. Nunca procurar instalações por nome de processo.
    ${If} ${FileExists} "$0\Acessa Workspace.exe"
      WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation" "$0"
    ${EndIf}
  ${EndIf}
!macroend

!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\prepare-update.ps1 "${PROJECT_DIR}/assets/prepare-update.ps1"
  !ifndef BUILD_UNINSTALLER
    File /oname=$PLUGINSDIR\update-files.json "${BUILD_RESOURCES_DIR}/update-files.json"
  !endif
  StrCpy $PowerShellPath "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$PowerShellPath" +2 0
    StrCpy $PowerShellPath "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  !ifdef BUILD_UNINSTALLER
    nsExec::ExecToStack /TIMEOUT=45000 '"$PowerShellPath" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\prepare-update.ps1" -InstallDirectory "$INSTDIR"'
  !else
    nsExec::ExecToStack /TIMEOUT=45000 '"$PowerShellPath" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\prepare-update.ps1" -InstallDirectory "$INSTDIR" -PayloadManifest "$PLUGINSDIR\update-files.json"'
  !endif
  Pop $0
  Pop $1
  ${If} $0 != 0
    DetailPrint "$1"
    MessageBox MB_ICONEXCLAMATION|MB_OK "Não foi possível liberar os arquivos. Feche o Acessa Workspace e tente novamente." /SD IDOK
    SetErrorLevel 10
    Quit
  ${EndIf}
!macroend

!macro customInstall
  ; Compatibilidade com ferramentas internas que ainda consultam InstallDir.
  WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" "InstallDir" "$INSTDIR"
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  ${If} $installMode != "CurrentUser"
    MessageBox MB_ICONSTOP|MB_OK "Instale o Acessa Workspace somente para o usuário atual." /SD IDOK
    SetErrorLevel 5
    Quit
  ${EndIf}
!macroend
