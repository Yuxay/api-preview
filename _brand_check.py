"""Check and manage CellCog running chats"""
import os
import sys
from cellcog import CellCogClient

api_key = os.environ.get("CELLCOG_API_KEY", "")
if not api_key:
    print("[ERROR] CELLCOG_API_KEY not set")
    sys.exit(1)

client = CellCogClient(agent_provider="openclaw")

# List running chats
try:
    chats = client.list_chats(status="running")
    print("Running chats:")
    for c in chats:
        print(f"  - {c.get('id', '?')}: {c.get('task_label', '?')} ({c.get('status', '?')})")
    if not chats:
        print("  (none)")
except Exception as e:
    print(f"Error listing chats: {e}")

# Also list all chats
print("\nAll recent chats:")
try:
    all_chats = client.list_chats()
    for c in all_chats[:5]:
        print(f"  - {c.get('id', '?')}: {c.get('task_label', '?')} ({c.get('status', '?')})")
except Exception as e:
    print(f"Error: {e}")
