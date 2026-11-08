; Inno Setup Script for Apitester Desktop
; Compile with: ISCC.exe setup.iss

#define MyAppName "Apitester"
#ifndef MyAppVersion
  #define MyAppVersion "0.2.1"
#endif
#define MyDefaultBackendPort "8999"
#define MyAppPublisher "Ridho Muhammad"
#define MyAppURL "https://apitester.app"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppCopyright=Ridho Muhammad
AppPublisherURL={#MyAppURL}
DefaultDirName=C:\Program Files\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=installer
OutputBaseFilename=Apitester-Setup-v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
UninstallDisplayIcon={app}\app.ico
SetupIconFile=build\favicon.ico
PrivilegesRequired=admin
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
Source: "build\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{commonappdata}\Apitester\data"
Name: "{commonappdata}\Apitester\logs"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\apitester.exe"; WorkingDir: "{app}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\apitester.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create Apitester-backend binPath= ""{app}\apitester-backend.exe --env """"{app}\.env.prod"""""" start= auto"; StatusMsg: "Registering backend service..."; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start Apitester-backend"; StatusMsg: "Starting backend service..."; Flags: runhidden
Filename: "{app}\apitester.exe"; Description: "Launch {#MyAppName}"; Flags: postinstall nowait skipifsilent shellexec

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop Apitester-backend"; Flags: runhidden; RunOnceId: "StopBackendService"
Filename: "{sys}\sc.exe"; Parameters: "delete Apitester-backend"; Flags: runhidden; RunOnceId: "DeleteBackendService"

[Code]
var
  PortPage: TInputQueryWizardPage;
  UpgradeOptionsPage: TInputOptionWizardPage;
  RemoveDataOnUninstall: Boolean;
  ExistingPortLoaded: Boolean;

function ReadExistingBackendPort(const InstallDir: String): String;
var
  Lines: TArrayOfString;
  I: Integer;
  Line: String;
begin
  Result := '{#MyDefaultBackendPort}';
  if not LoadStringsFromFile(AddBackslash(InstallDir) + '.env.prod', Lines) then
    exit;

  for I := 0 to GetArrayLength(Lines) - 1 do
  begin
    Line := Trim(Lines[I]);
    if Pos('APP_PORT=', Line) = 1 then
    begin
      Result := Trim(Copy(Line, Length('APP_PORT=') + 1, MaxInt));
      exit;
    end;
  end;
end;

function NormalizeBackendPort(var Port: String): Boolean;
var
  PortNumber: Integer;
begin
  Port := Trim(Port);
  PortNumber := StrToIntDef(Port, 0);
  Result := (PortNumber >= 1) and (PortNumber <= 65535);
  if Result then
    Port := IntToStr(PortNumber);
end;

function SelectedBackendPort: String;
begin
  Result := Trim(PortPage.Values[0]);
end;

function IsBackendPortInUse(const Port: String): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'),
    '/C netstat -ano -p TCP | findstr LISTENING | findstr /C:":' + Port + ' "',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function IsBackendServiceInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'),
    'query Apitester-backend', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and
    (ResultCode = 0);
end;

function StopExistingBackendService: Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if not IsBackendServiceInstalled then
    exit;

  if not Exec(ExpandConstant('{sys}\sc.exe'),
    'stop Apitester-backend', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := False;
    exit;
  end;

  Result := (ResultCode = 0) or (ResultCode = 1062);
end;

function RemoveExistingBackendService: Boolean;
var
  I: Integer;
  ResultCode: Integer;
begin
  Result := True;
  if not IsBackendServiceInstalled then
    exit;

  if not Exec(ExpandConstant('{sys}\sc.exe'),
    'delete Apitester-backend', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) or
    (ResultCode <> 0) then
  begin
    Result := False;
    exit;
  end;

  for I := 1 to 20 do
  begin
    if not IsBackendServiceInstalled then
      exit;
    Sleep(500);
  end;

  Result := not IsBackendServiceInstalled;
end;

function WriteEnvironmentFile: Boolean;
var
  Content: String;
  DataRoot: String;
begin
  DataRoot := ExpandConstant('{commonappdata}\Apitester');
  Result := ForceDirectories(ExpandConstant('{app}')) and
    ForceDirectories(DataRoot + '\data') and
    ForceDirectories(DataRoot + '\logs');
  if not Result then
    exit;

  Content :=
    'APP_PORT=' + SelectedBackendPort + #13#10 +
    'LOG_LEVEL=debug' + #13#10 +
    'LOG_PATH=' + DataRoot + '\logs\debug.log' + #13#10 +
    'BOLT_DB_PATH=' + DataRoot + '\data\collection.db' + #13#10 +
    'DEBUG=true' + #13#10;
  Result := SaveStringToFile(ExpandConstant('{app}\.env.prod'), Content, False);
end;

procedure InitializeWizard;
begin
  UpgradeOptionsPage := CreateInputOptionPage(wpSelectTasks,
    'Upgrade options', 'Choose what happens to existing data',
    'The backend service will be restarted and application files updated.',
    False, False);
  UpgradeOptionsPage.Add('Clear existing Apitester user data (saved data and logs)');
  UpgradeOptionsPage.Values[0] := False;

  PortPage := CreateInputQueryPage(UpgradeOptionsPage.ID,
    'Backend configuration', 'Choose the backend service port',
    'Enter an available TCP port between 1 and 65535.');
  PortPage.Add('Backend port:', False);
  PortPage.Values[0] := '{#MyDefaultBackendPort}';
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = PortPage.ID) and not ExistingPortLoaded then
  begin
    PortPage.Values[0] := ReadExistingBackendPort(WizardDirValue);
    ExistingPortLoaded := True;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Port: String;
begin
  Result := True;
  if CurPageID <> PortPage.ID then
    exit;

  Port := PortPage.Values[0];
  if not NormalizeBackendPort(Port) then
  begin
    MsgBox('Enter a valid backend port between 1 and 65535.', mbError, MB_OK);
    Result := False;
    exit;
  end;
  PortPage.Values[0] := Port;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  I: Integer;
  Port: String;
begin
  Result := '';
  Port := SelectedBackendPort;

  if not StopExistingBackendService then
  begin
    Result := 'Unable to stop the existing Apitester backend service.';
    exit;
  end;

  if not RemoveExistingBackendService then
  begin
    Result := 'Unable to remove the existing Apitester backend service.';
    exit;
  end;

  for I := 1 to 20 do
  begin
    if not IsBackendPortInUse(Port) then
      break;
    Sleep(500);
  end;

  if IsBackendPortInUse(Port) then
  begin
    Result := 'Backend port ' + Port + ' is already in use by another application.';
    exit;
  end;

  if UpgradeOptionsPage.Values[0] and
    DirExists(ExpandConstant('{commonappdata}\Apitester')) and
    not DelTree(ExpandConstant('{commonappdata}\Apitester'), True, True, True) then
  begin
    Result := 'Unable to clear the existing Apitester user data.';
    exit;
  end;

  if not WriteEnvironmentFile then
    Result := 'Unable to write the backend environment configuration.';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    RemoveDataOnUninstall := (SuppressibleMsgBox(
      'Remove all Apitester application data (logs and saved data)?',
      mbConfirmation, MB_YESNO, IDNO) = IDYES);

  if (CurUninstallStep = usPostUninstall) and RemoveDataOnUninstall then
    DelTree(ExpandConstant('{commonappdata}\Apitester'), True, True, True);
end;
