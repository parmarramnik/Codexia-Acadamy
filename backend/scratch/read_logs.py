import os

log_path = r"C:\Users\parma\.gemini\antigravity\brain\b9c4926c-52f0-4dea-891b-91f17356a0b7\.system_generated\tasks\task-3041.log"
if os.path.exists(log_path):
    with open(log_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    print("Total lines:", len(lines))
    print("--- LAST 60 LINES ---")
    for line in lines[-60:]:
        print(line, end="")
else:
    print("Log file not found at:", log_path)
