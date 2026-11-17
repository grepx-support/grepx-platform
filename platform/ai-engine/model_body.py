# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The body of Ollama's /api/create for one project's model: the base model + the project's context as its system
prompt (comments in the context file left out). Used by register.sh."""
import json
import re
import sys


def body(name: str, base: str, path: str) -> dict:
    text = re.sub(r"<!--.*?-->", "", open(path, encoding="utf-8").read(), flags=re.S).strip()
    return {"model": name, "from": base, "system": text, "stream": False, "parameters": {"temperature": 0.3, "num_ctx": 8192}}


if __name__ == "__main__":
    print(json.dumps(body(*sys.argv[1:4])))
