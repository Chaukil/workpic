"""Double-click launcher for the Windows IBM work-hours service (Python 3)."""
import os
import queue
import subprocess
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk
from tkinter.scrolledtext import ScrolledText


ROOT = Path(__file__).resolve().parent
URL = 'http://localhost:8080/'


class Launcher:
    def __init__(self, window):
        self.window = window
        self.process = None
        self.starting = False
        self.closing = False
        self.log_queue = queue.Queue()
        window.title('Workpic · Server giờ làm việc')
        window.geometry('720x650')
        window.minsize(540, 500)
        window.protocol('WM_DELETE_WINDOW', self.close)
        frame = ttk.Frame(window, padding=22)
        frame.pack(fill='both', expand=True)
        ttk.Label(frame, text='Server giờ làm việc', font=('Segoe UI', 16, 'bold')).pack(anchor='w')
        ttk.Label(frame, text='Nhập tài khoản IBM để khởi động và mở Workpic.').pack(anchor='w', pady=(6, 16))
        ttk.Label(frame, text='Tài khoản IBM').pack(anchor='w')
        self.username = ttk.Entry(frame)
        self.username.insert(0, os.environ.get('WORKHOURS_DB_USER', ''))
        self.username.pack(fill='x', pady=(3, 10))
        ttk.Label(frame, text='Mật khẩu').pack(anchor='w')
        self.password = ttk.Entry(frame, show='•')
        self.password.pack(fill='x', pady=(3, 14))
        ttk.Label(frame, text='Mở ứng dụng tại').pack(anchor='w')
        self.website = ttk.Combobox(frame, state='readonly', values=['https://chaukil.github.io/workpic/', URL])
        self.website.current(0)
        self.website.pack(fill='x', pady=(3, 14))
        buttons = ttk.Frame(frame)
        buttons.pack(fill='x')
        self.start_button = ttk.Button(buttons, text='Bật server và mở ứng dụng', command=self.start)
        self.start_button.pack(side='left')
        self.stop_button = ttk.Button(buttons, text='Dừng server', command=self.stop, state='disabled')
        self.stop_button.pack(side='right')
        self.status = tk.StringVar(value='Chưa khởi động. Mật khẩu không được lưu vào file.')
        ttk.Label(frame, textvariable=self.status, wraplength=460).pack(anchor='w', pady=(18, 8))
        ttk.Label(frame, text='Giữ cửa sổ này mở khi dùng. Đóng cửa sổ sẽ dừng server.', wraplength=460).pack(anchor='w')
        log_header = ttk.Frame(frame)
        log_header.pack(fill='x', pady=(14, 5))
        ttk.Label(log_header, text='Nhật ký server / lỗi IBM').pack(side='left')
        ttk.Button(log_header, text='Sao chép nhật ký', command=self.copy_log).pack(side='right')
        self.log = ScrolledText(frame, height=10, wrap='word', state='disabled')
        self.log.pack(fill='both', expand=True)
        window.bind('<Return>', lambda event: self.start())
        self.username.focus_set()
        window.after(1000, self.monitor)
        window.after(150, self.drain_log)

    def copy_log(self):
        self.window.clipboard_clear()
        self.window.clipboard_append(self.log.get('1.0', 'end-1c'))

    def read_log(self, process, password):
        try:
            for line in process.stdout:
                # Mask the secret even if PowerShell startup errors echo source lines.
                line = line.replace(password, '[REDACTED]')
                self.log_queue.put(line)
        finally:
            process.stdout.close()

    def drain_log(self):
        self.log.configure(state='normal')
        while True:
            try:
                self.log.insert('end', self.log_queue.get_nowait())
            except queue.Empty:
                break
        if int(self.log.index('end-1c').split('.')[0]) > 1500:
            self.log.delete('1.0', '500.0')
        self.log.see('end')
        self.log.configure(state='disabled')
        self.window.after(150, self.drain_log)

    def start(self):
        if self.process is not None or self.starting:
            return
        username = self.username.get().strip()
        password = self.password.get()
        if not username or not password:
            messagebox.showwarning('Thiếu tài khoản', 'Nhập tài khoản và mật khẩu IBM.', parent=self.window)
            return
        script = ROOT / 'serve-work-hours.ps1'
        if not script.is_file():
            messagebox.showerror('Thiếu file', f'Không tìm thấy {script}', parent=self.window)
            return
        # Never attach to or stop an unrelated service already using this port.
        import socket
        try:
            with socket.create_connection(('localhost', 8080), timeout=1):
                messagebox.showwarning('Cổng 8080 đang được dùng', 'Hãy dừng server cũ trước khi bật server từ cửa sổ này.', parent=self.window)
                return
        except OSError:
            pass
        env = os.environ.copy()
        env['WORKHOURS_DB_USER'] = username
        env['WORKHOURS_DB_PASSWORD'] = password
        try:
            self.process = subprocess.Popen(
                ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(script)],
                cwd=str(ROOT), env=env, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except OSError as error:
            messagebox.showerror('Không bật được server', str(error), parent=self.window)
            return
        finally:
            env.pop('WORKHOURS_DB_PASSWORD', None)
        self.password.delete(0, 'end')
        self.starting = True
        self.start_button.configure(state='disabled')
        self.stop_button.configure(state='normal')
        self.status.set('Đang khởi động server…')
        process = self.process
        threading.Thread(target=self.read_log, args=(process, password), daemon=True).start()
        threading.Thread(target=self.wait_ready, args=(process,), daemon=True).start()

    def wait_ready(self, process):
        deadline = time.monotonic() + 20
        # Ignore system proxies for this local readiness check.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        while time.monotonic() < deadline and process.poll() is None:
            try:
                with opener.open(URL, timeout=1) as response:
                    ready = response.status == 200
                if ready:
                    if not self.closing:
                        self.window.after(0, lambda: self.ready(process))
                    return
            except OSError:
                time.sleep(0.3)
        if not self.closing:
            self.window.after(0, lambda: self.failed(process))

    def ready(self, process):
        if self.process is not process or process.poll() is not None:
            return
        self.starting = False
        self.status.set(f'Server đang chạy: {URL}\nVào “Update giờ làm việc” để lấy dữ liệu IBM.')
        webbrowser.open(self.website.get())

    def failed(self, process):
        if self.process is not process:
            return
        self.stop()
        self.status.set('Không khởi động được server. Xem nhật ký bên dưới để biết chi tiết lỗi.')

    def stop(self):
        process, self.process = self.process, None
        self.starting = False
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
        self.start_button.configure(state='normal')
        self.stop_button.configure(state='disabled')
        self.status.set('Server đã dừng.')

    def monitor(self):
        if self.process is not None and not self.starting and self.process.poll() is not None:
            self.stop()
            self.status.set('Server đã thoát. Xem nhật ký bên dưới để biết chi tiết lỗi.')
        self.window.after(1000, self.monitor)

    def close(self):
        self.closing = True
        self.stop()
        self.window.destroy()


if __name__ == '__main__':
    app = tk.Tk()
    Launcher(app)
    app.mainloop()
