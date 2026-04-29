@echo off
echo 正在构建桌面窗口版 EXE...
cd /d "%~dp0desktop"
python assets\generate_icon.py
if errorlevel 1 goto :error
cd /d "%~dp0backend"
call npm install
if errorlevel 1 goto :error
call npm run package-win
if errorlevel 1 goto :error
cd /d "%~dp0desktop"
dotnet publish -c Release -r win-x64 --self-contained false
if errorlevel 1 goto :error
powershell -ExecutionPolicy Bypass -File installer\build-installer.ps1
if errorlevel 1 goto :error
echo.
echo 打包完成：desktop\bin\Release\net9.0-windows\win-x64\publish\ScoreMarker.Desktop.exe
echo 请连同同目录下的 Resources 文件夹一起使用。
echo 安装包：desktop\release\ScoreMarker-Setup.exe
pause
exit /b 0

:error
echo.
echo 打包失败，请检查上面的输出信息。
pause
exit /b 1
