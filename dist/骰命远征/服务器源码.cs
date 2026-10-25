// 骰命远征 —— 免安装静态服务器（Windows 自带 .NET 编译，双击即玩）
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

class DiceServer {
    static string root;
    static int Main(string[] args) {
        root = Path.GetFullPath(args.Length > 0 ? args[0] : "web");
        int port = args.Length > 1 ? int.Parse(args[1]) : 8787;
        if (!Directory.Exists(root)) {
            Console.WriteLine("web folder not found: " + root);
            Console.WriteLine("put this exe next to the web folder");
            Console.ReadKey(); return 1;
        }
        TcpListener l;
        try { l = new TcpListener(IPAddress.Any, port); l.Start(); }
        catch (Exception e) {
            Console.WriteLine("port " + port + " busy: " + e.Message);
            Console.ReadKey(); return 1;
        }
        Console.WriteLine("Dice Fate Expedition is running!");
        Console.WriteLine("  PC:    http://localhost:" + port);
        Console.WriteLine("  Phone: http://<this PC's IP>:" + port + "  (same Wi-Fi)");
        Console.WriteLine("Close this window to quit.");
        try { System.Diagnostics.Process.Start("http://localhost:" + port); } catch { }
        while (true) { Task.Run(() => Handle(l.AcceptTcpClient())); }
    }

    static void Handle(TcpClient c) {
        using (c) {
            var s = c.GetStream();
            var buf = new byte[8192];
            int n;
            try { n = s.Read(buf, 0, buf.Length); } catch { return; }
            if (n <= 0) { return; }
            var parts = Encoding.ASCII.GetString(buf, 0, n).Split(' ');
            if (parts.Length < 2 || parts[0] != "GET") { return; }
            var path = Uri.UnescapeDataString(parts[1].Split('?')[0]);
            if (path == "/") { path = "/index.html"; }
            var file = Path.GetFullPath(Path.Combine(root, path.TrimStart('/', '\\')));
            byte[] body; string mime = "text/plain"; int code = 200;
            if (file.StartsWith(root) && File.Exists(file)) {
                body = File.ReadAllBytes(file); mime = Mime(file);
            } else {
                body = Encoding.UTF8.GetBytes("404"); code = 404;
            }
            var head = Encoding.ASCII.GetBytes(
                "HTTP/1.0 " + code + " OK\r\nContent-Type: " + mime +
                "\r\nContent-Length: " + body.Length + "\r\n\r\n");
            s.Write(head, 0, head.Length);
            s.Write(body, 0, body.Length);
        }
    }

    static string Mime(string f) {
        switch (Path.GetExtension(f).ToLower()) {
            case ".html": case ".htm": return "text/html; charset=utf-8";
            case ".js": case ".mjs": return "application/javascript";
            case ".css": return "text/css";
            case ".json": return "application/json";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".gif": return "image/gif";
            case ".svg": return "image/svg+xml";
            case ".wasm": return "application/wasm";
            case ".ico": return "image/x-icon";
            case ".woff": case ".woff2": case ".ttf": return "font/woff";
            default: return "application/octet-stream";
        }
    }
}
