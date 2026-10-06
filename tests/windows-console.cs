using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Compiled locally by PowerShell Add-Type; no downloaded binaries or packages.
public static class ShutdownConsoleHarness
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public uint cb;
        public string reserved, desktop, title;
        public uint x, y, xSize, ySize, xCountChars, yCountChars, fillAttribute, flags;
        public ushort showWindow, reserved2Size;
        public IntPtr reserved2, stdin, stdout, stderr;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo
    {
        public IntPtr process, thread;
        public uint processId, threadId;
    }
    private delegate bool ControlHandler(uint control);
    // Keep the delegate alive while Windows can call it on a native thread.
    private static readonly ControlHandler IgnoreControl = delegate(uint control) { return true; };

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcessW(string app, StringBuilder command, IntPtr processAttributes,
        IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment,
        string directory, ref StartupInfo startup, out ProcessInfo info);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AttachConsole(uint pid);
    [DllImport("kernel32.dll")]
    private static extern bool FreeConsole();
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetConsoleCtrlHandler(ControlHandler handler, bool add);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GenerateConsoleCtrlEvent(uint control, uint group);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostMessageW(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll")]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static void Check(bool success, string operation)
    {
        if (!success) throw new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }
    private static string Quote(string value)
    {
        // These arguments are paths and fixed test tokens, never shell commands.
        if (value.Contains("\"") || value.EndsWith("\\"))
            throw new ArgumentException("Unexpected Windows argument: " + value);
        return "\"" + value + "\"";
    }
    private static string ReadJournal(string journal)
    {
        if (!File.Exists(journal)) return "";
        using (var file = new FileStream(journal, FileMode.Open, FileAccess.Read,
            FileShare.ReadWrite | FileShare.Delete))
        using (var reader = new StreamReader(file)) return reader.ReadToEnd();
    }
    private static void AwaitMarker(ProcessInfo info, string journal, string marker, int occurrences)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            if (ReadJournal(journal).Split(new string[] { marker }, StringSplitOptions.None).Length - 1 >= occurrences)
                return;
            if (WaitForSingleObject(info.process, 0) == 0)
                throw new Exception("Node exited before marker: " + marker + "\n" + ReadJournal(journal));
            Thread.Sleep(10);
        }
        throw new TimeoutException("Missing Node marker: " + marker + "\n" + ReadJournal(journal));
    }

    public static uint Run(string node, string fixture, string journal, string signal, string mode, string action)
    {
        var startup = new StartupInfo();
        startup.cb = (uint)Marshal.SizeOf(startup);
        startup.flags = 1; // STARTF_USESHOWWINDOW
        startup.showWindow = 0; // SW_HIDE; still creates a genuine console.
        ProcessInfo info;
        var command = new StringBuilder(Quote(node) + " " + Quote(fixture) + " " +
            Quote(signal) + " " + Quote(mode) + " " + Quote(journal));
        // CREATE_NEW_CONSOLE, without CREATE_NEW_PROCESS_GROUP (which disables Ctrl+C).
        Check(CreateProcessW(node, command, IntPtr.Zero, IntPtr.Zero, false, 0x10,
            IntPtr.Zero, null, ref startup, out info), "CreateProcessW");
        bool attached = false;
        try
        {
            AwaitMarker(info, journal, "ready\n", 1);
            if (action == "terminate") Check(TerminateProcess(info.process, 99), "TerminateProcess");
            else
            {
                // This PowerShell helper is itself isolated; the test runner never detaches.
                FreeConsole();
                Check(AttachConsole(info.processId), "AttachConsole");
                attached = true;
                Check(SetConsoleCtrlHandler(IgnoreControl, true), "SetConsoleCtrlHandler");
                if (action == "close")
                {
                    IntPtr window = GetConsoleWindow();
                    if (window == IntPtr.Zero) throw new Exception("No native console window");
                    // Detach before WM_CLOSE so only the fixture is subject to console closure.
                    FreeConsole();
                    attached = false;
                    Check(PostMessageW(window, 0x0010, IntPtr.Zero, IntPtr.Zero), "WM_CLOSE");
                }
                else
                {
                    uint control = signal == "SIGBREAK" ? 1u : 0u;
                    // Group zero broadcasts only inside the fixture's isolated console.
                    Check(GenerateConsoleCtrlEvent(control, 0), "GenerateConsoleCtrlEvent");
                    if (mode == "interrupted")
                    {
                        AwaitMarker(info, journal, "signal-start:" + signal + "\n", 1);
                        Check(TerminateProcess(info.process, 99), "TerminateProcess during cleanup");
                    }
                    else if (mode == "repeat")
                    {
                        AwaitMarker(info, journal, "signal-end:" + signal + "\n", 1);
                        Check(GenerateConsoleCtrlEvent(control, 0), "GenerateConsoleCtrlEvent repeat");
                        AwaitMarker(info, journal, "signal-end:" + signal + "\n", 2);
                        Check(TerminateProcess(info.process, 99), "TerminateProcess after repeat");
                    }
                }
            }
            if (WaitForSingleObject(info.process, 10000) != 0)
                throw new TimeoutException("Node did not exit\n" + ReadJournal(journal));
            uint code;
            Check(GetExitCodeProcess(info.process, out code), "GetExitCodeProcess");
            return code;
        }
        finally
        {
            if (attached) FreeConsole();
            // Every error path kills and reaps the fixture, including a failed native call.
            if (WaitForSingleObject(info.process, 0) != 0)
            {
                TerminateProcess(info.process, 98);
                WaitForSingleObject(info.process, 5000);
            }
            CloseHandle(info.thread);
            CloseHandle(info.process);
        }
    }
}
