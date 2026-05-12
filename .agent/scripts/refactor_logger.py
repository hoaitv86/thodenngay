import re

files_to_update = [
    'd:/PROJS/VDC-Agentic-Ops/agents/agent_logic.py',
    'd:/PROJS/VDC-Agentic-Ops/run_v2_manual.py',
    'd:/PROJS/VDC-Agentic-Ops/run_v3.py'
]

for fpath in files_to_update:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add the logger import right after "import os"
    if 'from utils.logger import logger' not in content:
        content = content.replace('import os', 'import os\nfrom utils.logger import logger', 1)

    # 1. Replace print( with logger.info(
    content = re.sub(r'print\(', 'logger.info(', content)
    
    # 2. Replace flush=True argument
    content = re.sub(r',\s*flush=True\)', ')', content)
    
    # 3. Specifically fix up error logs in agent_logic.py
    content = content.replace('logger.info(f"      Error calling Gemini', 'logger.error(f"      Error calling Gemini')
    content = content.replace('logger.info(f"Failed to parse JSON', 'logger.error(f"Failed to parse JSON')
    
    # 4. Specifically fix up error logs in run scripts
    content = content.replace('logger.info(f"Error:', 'logger.error(f"Error:')

    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement complete.")
