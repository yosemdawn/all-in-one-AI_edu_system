using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Windows;

namespace ScoreMarker.Desktop;

public partial class MainWindow : Window
{
    private const string AppUrl = "http://127.0.0.1:3000";
    private static readonly string LogPath = Path.Combine(Path.GetTempPath(), "score-marker-desktop.log");
    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(2) };
    private Process? _backendProcess;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        try
        {
            Log("window loaded");
            await StartBackendAsync();
            await AppWebView.EnsureCoreWebView2Async();
            AppWebView.Source = new Uri(AppUrl);
            Log("webview navigation started");
            LoadingOverlay.Visibility = Visibility.Collapsed;
        }
        catch (Exception ex)
        {
            Log($"startup error: {ex}");
            MessageBox.Show(
                $"桌面应用启动失败：{ex.Message}",
                "启动失败",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Close();
        }
    }

    private async Task StartBackendAsync()
    {
        var backendExePath = Path.Combine(AppContext.BaseDirectory, "Resources", "score-marker.exe");
        Log($"backend path: {backendExePath}");
        if (!File.Exists(backendExePath))
        {
            throw new FileNotFoundException($"未找到后端程序：{backendExePath}");
        }

        _backendProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = backendExePath,
                WorkingDirectory = Path.GetDirectoryName(backendExePath)!,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardError = true,
                RedirectStandardOutput = true,
            },
            EnableRaisingEvents = true,
        };
        _backendProcess.StartInfo.Environment["OPEN_BROWSER"] = "false";
        _backendProcess.OutputDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
            {
                Log($"backend stdout: {args.Data}");
            }
        };
        _backendProcess.ErrorDataReceived += (_, args) =>
        {
            if (!string.IsNullOrWhiteSpace(args.Data))
            {
                Log($"backend stderr: {args.Data}");
            }
        };

        if (!_backendProcess.Start())
        {
            throw new InvalidOperationException("无法启动后端服务。");
        }
        Log($"backend started with pid {_backendProcess.Id}");
        _backendProcess.BeginOutputReadLine();
        _backendProcess.BeginErrorReadLine();

        var ready = await WaitForServerAsync();
        if (!ready)
        {
            throw new TimeoutException("本地服务启动超时，请稍后重试。");
        }
    }

    private async Task<bool> WaitForServerAsync()
    {
        for (var attempt = 0; attempt < 30; attempt++)
        {
            if (_backendProcess?.HasExited == true)
            {
                Log($"backend exited with code {_backendProcess.ExitCode}");
                throw new InvalidOperationException($"后端程序已退出，退出码：{_backendProcess.ExitCode}");
            }

            try
            {
                using var response = await _httpClient.GetAsync(AppUrl);
                if (response.IsSuccessStatusCode)
                {
                    Log("backend reachable");
                    return true;
                }
            }
            catch
            {
                // Server is still starting up.
            }

            await Task.Delay(1000);
        }

        return false;
    }

    private static void Log(string message)
    {
        File.AppendAllText(LogPath, $"[{DateTime.Now:O}] {message}{Environment.NewLine}");
    }

    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        try
        {
            if (_backendProcess is { HasExited: false })
            {
                _backendProcess.Kill(true);
            }
        }
        catch
        {
            // Ignore shutdown cleanup errors.
        }
        finally
        {
            _backendProcess?.Dispose();
            _httpClient.Dispose();
        }
    }
}
