using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;

var targetRoot = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "Programs",
    "Score Marker");

Console.WriteLine("正在安装智能批分助手...");
Console.WriteLine($"安装目录: {targetRoot}");

Directory.CreateDirectory(targetRoot);
KillRunningProcesses();
ExtractEmbeddedPackage(targetRoot);
CreateShortcuts(targetRoot);
LaunchApp(targetRoot);

Console.WriteLine("安装完成，程序即将启动。");

static void ExtractEmbeddedPackage(string targetRoot)
{
    foreach (var entry in Directory.GetFileSystemEntries(targetRoot))
    {
        if (Directory.Exists(entry))
        {
            Directory.Delete(entry, recursive: true);
        }
        else
        {
            File.Delete(entry);
        }
    }

    var assembly = Assembly.GetExecutingAssembly();
    const string resourceName = "ScoreMarker.Setup.package.app.zip";
    using var resourceStream = assembly.GetManifestResourceStream(resourceName)
        ?? throw new InvalidOperationException("安装资源不存在。");

    var tempZip = Path.Combine(Path.GetTempPath(), $"score-marker-{Guid.NewGuid():N}.zip");
    using (var fileStream = File.Create(tempZip))
    {
        resourceStream.CopyTo(fileStream);
    }

    try
    {
        ZipFile.ExtractToDirectory(tempZip, targetRoot, overwriteFiles: true);
    }
    finally
    {
        File.Delete(tempZip);
    }
}

static void CreateShortcuts(string targetRoot)
{
    var startMenuDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
        "Programs",
        "Score Marker");
    var desktopShortcut = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
        "智能批分助手.lnk");

    Directory.CreateDirectory(startMenuDir);

    var appExe = Path.Combine(targetRoot, "ScoreMarker.Desktop.exe");
    var uninstallScript = Path.Combine(targetRoot, "uninstall.ps1");

    CreateShortcut(
        Path.Combine(startMenuDir, "智能批分助手.lnk"),
        appExe,
        targetRoot,
        appExe,
        null);

    CreateShortcut(
        desktopShortcut,
        appExe,
        targetRoot,
        appExe,
        null);

    CreateShortcut(
        Path.Combine(startMenuDir, "卸载智能批分助手.lnk"),
        "powershell.exe",
        targetRoot,
        "powershell.exe",
        $"-ExecutionPolicy Bypass -File \"{uninstallScript}\"");
}

static void CreateShortcut(
    string shortcutPath,
    string targetPath,
    string workingDirectory,
    string iconLocation,
    string? arguments)
{
    Type shellType = Type.GetTypeFromProgID("WScript.Shell")
        ?? throw new InvalidOperationException("WScript.Shell is unavailable.");
    dynamic shell = Activator.CreateInstance(shellType)
        ?? throw new InvalidOperationException("Failed to create WScript.Shell.");
    dynamic shortcut = shell.CreateShortcut(shortcutPath);
    shortcut.TargetPath = targetPath;
    shortcut.WorkingDirectory = workingDirectory;
    shortcut.IconLocation = iconLocation;
    if (!string.IsNullOrWhiteSpace(arguments))
    {
        shortcut.Arguments = arguments;
    }
    shortcut.Save();
}

static void LaunchApp(string targetRoot)
{
    Process.Start(new ProcessStartInfo
    {
        FileName = Path.Combine(targetRoot, "ScoreMarker.Desktop.exe"),
        WorkingDirectory = targetRoot,
        UseShellExecute = true
    });
}

static void KillRunningProcesses()
{
    foreach (var process in Process.GetProcessesByName("ScoreMarker.Desktop"))
    {
        try
        {
            process.Kill(entireProcessTree: true);
        }
        catch
        {
            // Ignore cleanup failures.
        }
    }
}
