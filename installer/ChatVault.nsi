; ChatVault Setup v0.1.3. Browser confirmation is mandatory.
Unicode true
!include "MUI2.nsh"
!ifndef REPO_ROOT
 !define REPO_ROOT ".."
!endif
!ifndef OUTPUT_FILE
 !define OUTPUT_FILE "ChatVault-Setup-v0.1.3.exe"
!endif
Name "ChatVault v0.1.3"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\ChatVault"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
VIProductVersion "0.1.3.0"
VIAddVersionKey "ProductName" "ChatVault"
VIAddVersionKey "FileDescription" "ChatVault Windows setup assistant"
VIAddVersionKey "FileVersion" "0.1.3"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Daniil Goncharov"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\INSTALL_IN_BRAVE.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Открыть инструкцию для Brave / Chrome"
!insertmacro MUI_PAGE_WELCOME
; Per-user directory is intentionally fixed. Do not let users choose Program Files.
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"
Function .onInit
 SetShellVarContext current
 StrCpy $INSTDIR "$LOCALAPPDATA\\ChatVault"
FunctionEnd
Section "ChatVault extension files" SecMain
 SetOutPath "$INSTDIR\Extension"
 File /r "${REPO_ROOT}\dist\*.*"
 SetOutPath "$INSTDIR"
 File "${REPO_ROOT}\installer\INSTALL_IN_BRAVE.txt"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\ChatVault"
 CreateShortCut "$SMPROGRAMS\ChatVault\Папка расширения.lnk" "$WINDIR\explorer.exe" '"$INSTDIR\Extension"'
 CreateShortCut "$SMPROGRAMS\ChatVault\Инструкция.lnk" "$INSTDIR\INSTALL_IN_BRAVE.txt"
 CreateShortCut "$SMPROGRAMS\ChatVault\Удаление.lnk" "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault" "DisplayName" "ChatVault v0.1.3"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault" "DisplayVersion" "0.1.3"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault" "Publisher" "Daniil Goncharov"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 DetailPrint "Files copied. Browser installation requires manual confirmation."
SectionEnd
Section "Uninstall"
 MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "Сначала удалите ChatVault из Brave/Chrome. При удалении расширения браузер может удалить локальные резервные копии. Сохраните ZIP перед удалением.$\r$\n$\r$\nПродолжить удаление файлов?" IDOK continue_uninstall
 Abort
 continue_uninstall:
 RMDir /r "$INSTDIR\Extension"
 Delete "$INSTDIR\INSTALL_IN_BRAVE.txt"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 Delete "$SMPROGRAMS\ChatVault\Папка расширения.lnk"
 Delete "$SMPROGRAMS\ChatVault\Инструкция.lnk"
 Delete "$SMPROGRAMS\ChatVault\Удаление.lnk"
 RMDir "$SMPROGRAMS\ChatVault"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ChatVault"
SectionEnd