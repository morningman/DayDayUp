"""
Shawn 每日学习计划 - 后端服务
提供静态文件服务 + 自定义模版的文件存储 API
"""

import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PORT = 8080
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
TEMPLATES_FILE = os.path.join(DATA_DIR, 'custom_templates.json')


def ensure_data_dir():
    """确保 data 目录存在"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(TEMPLATES_FILE):
        with open(TEMPLATES_FILE, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False)


def load_templates():
    """读取自定义模版"""
    try:
        with open(TEMPLATES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_templates(templates):
    """保存自定义模版"""
    with open(TEMPLATES_FILE, 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)


class RequestHandler(SimpleHTTPRequestHandler):
    """自定义请求处理器：静态文件 + API"""

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/templates':
            # 获取自定义模版列表
            templates = load_templates()
            self._send_json(200, templates)
        else:
            # 静态文件服务
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/templates':
            # 新增自定义模版
            body = self._read_body()
            if body is None:
                return

            templates = load_templates()
            templates.append(body)
            save_templates(templates)
            self._send_json(201, body)

        elif parsed.path == '/api/templates/delete':
            # 删除自定义模版
            body = self._read_body()
            if body is None:
                return

            template_id = body.get('id')
            if not template_id:
                self._send_json(400, {'error': '缺少模版 ID'})
                return

            templates = load_templates()
            templates = [t for t in templates if t.get('id') != template_id]
            save_templates(templates)
            self._send_json(200, {'message': '已删除'})

        else:
            self._send_json(404, {'error': '未找到'})

    def _read_body(self):
        """读取并解析 JSON 请求体"""
        try:
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length)
            return json.loads(raw.decode('utf-8'))
        except (ValueError, json.JSONDecodeError) as e:
            self._send_json(400, {'error': f'无效的请求数据: {e}'})
            return None

    def _send_json(self, status, data):
        """发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        """简化日志输出"""
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    ensure_data_dir()
    server = HTTPServer(('0.0.0.0', PORT), RequestHandler)
    print(f'\n  🌟 Shawn 每日学习计划 服务已启动')
    print(f'  📂 数据存储目录: {DATA_DIR}')
    print(f'  🌐 访问地址: http://localhost:{PORT}')
    print(f'  按 Ctrl+C 停止服务\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  🛑 服务已停止')
        server.server_close()


if __name__ == '__main__':
    main()
