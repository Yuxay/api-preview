"""
ApiPreview Brand via CellCog — direct API approach
"""
import os, sys, time, json, certifi

# Fix SSL CA bundle for Anaconda Python
os.environ.setdefault('REQUESTS_CA_BUNDLE', certifi.where())

import requests

API_KEY = os.environ.get("CELLCOG_API_KEY", "")
if not API_KEY:
    # Try to get from registry via PowerShell
    import subprocess
    result = subprocess.run(
        ['powershell', '-Command', 
         "(Get-ItemProperty -Path 'HKCU:\\Environment' -Name CELLCOG_API_KEY).CELLCOG_API_KEY"],
        capture_output=True, text=True
    )
    API_KEY = result.stdout.strip()

if not API_KEY:
    print("[ERROR] CELLCOG_API_KEY not found")
    sys.exit(1)

BASE = "https://cellcog.ai/api"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
    "X-CellCog-Python-SDK-Version": "2.2.0",
}

print(f"[OK] Key loaded: {API_KEY[:12]}...")

def api_request(method, path, data=None, max_retries=3):
    """Make API request with retry"""
    url = f"{BASE}{path}"
    last_error = None
    for attempt in range(max_retries):
        try:
            session = requests.Session()
            # Force HTTP/1.1, disable connection pooling issues
            resp = session.request(
                method=method,
                url=url,
                headers=HEADERS,
                json=data,
                timeout=120,
            )
            return resp
        except requests.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f"  [Retry {attempt+1}/{max_retries-1}] {e.__class__.__name__}, waiting {wait}s...")
                time.sleep(wait)
    raise last_error

# Step 1: Create chat
print("Step 1: Creating chat...")
prompt = """为开源项目「ApiPreview」设计品牌 Logo 和 Slogan。

## 项目定位
ApiPreview 是一款轻量级 Swagger / OpenAPI 桌面阅读器 + 轻调试工具。基于 Electron + Vue 3 + TypeScript 构建，纯本地运行。

## 核心卖点
- 零 CORS：Electron 主进程发请求，无视浏览器跨域限制
- 极轻量：不到 100KB 渲染层 JS，秒启动
- 纯本地：不依赖任何外部服务，内网可用
- 多源管理：一个窗口管理所有微服务文档
- Diff 引擎：自动对比 API 文档变更
- Try It：内置请求调试，自动填充参数

## 目标用户
后端/前端开发者、API 消费者、微服务团队

## 品牌调性
- 专业但不沉重（不像 Postman 那样臃肿）
- 轻快、高效、精准
- 技术感但有人情味

## 需要交付
1. Slogan（中文 + 英文各一版）
2. Logo 设计理念描述
3. 配色方案（含 hex 色值）
4. 字体推荐
5. Logo 图像（SVG 或 PNG 格式）
"""

payload = {
    "message": prompt,
    "chat_mode": "agent_core",
    "task_label": "apipreview-brand-6",
}

resp = api_request("POST", "/cellcog/chat/new", payload)
print(f"  Status: {resp.status_code}")
result = resp.json()
print(f"  Response keys: {list(result.keys())}")
chat_id = result.get("chat_id")
print(f"  Chat ID: {chat_id}")

if not chat_id:
    print(f"  Full response: {json.dumps(result, indent=2)[:1000]}")
    sys.exit(1)

# Step 2: Poll for completion
print(f"\nStep 2: Waiting for chat {chat_id} to complete...")
max_wait = 360  # 6 minutes
poll_interval = 5
elapsed = 0

while elapsed < max_wait:
    time.sleep(poll_interval)
    elapsed += poll_interval
    
    resp = api_request("GET", f"/cellcog/chat/{chat_id}")
    if resp.status_code != 200:
        print(f"  Poll error: {resp.status_code} {resp.text[:200]}")
        continue
    
    chat = resp.json()
    status = chat.get("status", "unknown")
    progress = chat.get("progress", "")
    print(f"  [{elapsed}s] Status: {status} {progress}")
    
    if status in ("completed", "finished", "done"):
        print("\n=== BRAND RESULT ===")
        messages = chat.get("messages", [])
        for msg in messages:
            role = msg.get("role", "?")
            content = msg.get("content", "")
            if role == "assistant":
                print(content)
        break
    elif status in ("failed", "error"):
        print(f"\nChat failed: {json.dumps(chat, indent=2)[:1000]}")
        break
else:
    print(f"\nTimed out after {max_wait}s. Chat may still be running.")
    print(f"Chat ID: {chat_id}")
