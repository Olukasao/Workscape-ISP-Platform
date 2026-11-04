; One installation/upgrade policy for Windows and Linux cross-builds.
Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
Name "${PRODUCT_NAME}"
InstallDir "$LOCALAPPDATA\Programs\Acessa Workspace"
InstallDirRegKey HKCU "Software\AcessaWorkspace" "InstallDir"
RequestExecutionLevel user
SetCompressor zlib
SetOverwrite on
ShowInstDetails show
Var SetupMutex
Var PrepareExitCode
Var PrepareOutput
Var PowerShellExe
!define /redef MUI_ICON "${PROJECT_DIR}/assets/icon.ico"
!define /redef MUI_UNICON "${PROJECT_DIR}/assets/icon.ico"
!define /redef MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Este assistente instala ou atualiza o Acessa Workspace.$\r$\n$\r$\nSe o aplicativo estiver aberto ou na bandeja, ele será encerrado para substituir os arquivos. Salve o que estiver editando antes de continuar.$\r$\n$\r$\nSuas configurações e dados de acesso serão preservados."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define /redef MUI_FINISHPAGE_RUN "$INSTDIR\Acessa Workspace.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

!macro InitSetup
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Este aplicativo requer Windows de 64 bits."
    SetErrorLevel 1633
    Quit
  ${EndIf}
  ; One installer/uninstaller per interactive session. Keep handle until exit.
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\AcessaWorkspace.Setup") p.r0 ?e'
  Pop $1
  StrCpy $SetupMutex $0
  ${If} $0 == 0
  ${OrIf} $1 == 183
    MessageBox MB_ICONSTOP "Já existe uma instalação ou desinstalação do Acessa Workspace em andamento." /SD IDOK
    SetErrorLevel 1618
    Quit
  ${EndIf}
  StrCpy $PowerShellExe "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "$PowerShellExe" +2 0
    StrCpy $PowerShellExe "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
!macroend
Function .onInit
  !insertmacro InitSetup
FunctionEnd
Function un.onInit
  !insertmacro InitSetup
FunctionEnd

!macro PrepareApplication PayloadArgument
  InitPluginsDir
  File /oname=$PLUGINSDIR\prepare-update.ps1 "${PROJECT_DIR}/assets/prepare-update.ps1"
  prepare_again:
    DetailPrint "Preparando os arquivos do Acessa Workspace..."
    nsExec::ExecToStack /TIMEOUT=45000 '"$PowerShellExe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\prepare-update.ps1" -InstallDirectory "$INSTDIR" ${PayloadArgument}'
    Pop $PrepareExitCode
    Pop $PrepareOutput
    DetailPrint "$PrepareOutput"
    ${If} $PrepareExitCode != 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Não foi possível liberar a pasta para gravação.$\r$\n$\r$\nFeche o Acessa Workspace pelo menu da bandeja e confira a permissão de escrita na pasta escolhida. Clique em Repetir para tentar novamente.$\r$\n$\r$\n$PrepareOutput" /SD IDCANCEL IDRETRY prepare_again
      SetErrorLevel 10
      Quit
    ${EndIf}
!macroend

Section "Acessa Workspace"
  SetShellVarContext current
  ; Extract into a temporary directory first. Locked installed files are not
  ; touched until the helper finishes its complete permission/lock preflight.
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\payload"
  File /r "${PROJECT_DIR}/release/win-unpacked/*"
  !insertmacro PrepareApplication '-PayloadDirectory "$PLUGINSDIR\payload"'
  SetOutPath "$INSTDIR"
  ClearErrors
  CopyFiles /SILENT "$PLUGINSDIR\payload\*" "$INSTDIR"
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "Não foi possível copiar os arquivos. Execute o instalador novamente para concluir a atualização." /SD IDOK
    SetErrorLevel 11
    Quit
  ${EndIf}
  ClearErrors
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ${If} ${Errors}
    SetErrorLevel 12
    MessageBox MB_ICONSTOP "Não foi possível gravar o desinstalador. Confira a permissão da pasta e execute o setup novamente." /SD IDOK
    Quit
  ${EndIf}
  CreateDirectory "$SMPROGRAMS\Acessa Workspace"
  CreateShortcut "$SMPROGRAMS\Acessa Workspace\Acessa Workspace.lnk" "$INSTDIR\Acessa Workspace.exe"
  CreateShortcut "$DESKTOP\Acessa Workspace.lnk" "$INSTDIR\Acessa Workspace.exe"
  WriteRegStr HKCU "Software\AcessaWorkspace" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "DisplayName" "Acessa Workspace"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "Publisher" "AcessaNet"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace" "NoRepair" 1
  SetErrorLevel 0
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  !insertmacro PrepareApplication ''
  SetOutPath "$TEMP"
  Delete "$DESKTOP\Acessa Workspace.lnk"
  RMDir /r "$SMPROGRAMS\Acessa Workspace"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AcessaWorkspace"
  DeleteRegKey HKCU "Software\AcessaWorkspace"
  RMDir /r "$INSTDIR"
  ; The userData directory under APPDATA is deliberately preserved.
SectionEnd
