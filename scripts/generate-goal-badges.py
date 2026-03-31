"""
Generate test badge images for the Goal Archive using HF Inference API.

Usage:
    export HF_TOKEN="hf_..."
    python3 scripts/generate-goal-badges.py

Generates icon-style images for sample goals via the fal-ai provider
and saves them to scripts/generated-badges/.
"""

import os
import sys
from pathlib import Path

from huggingface_hub import InferenceClient

# Load .env file from project root if present
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key.strip(), value)

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    print("Error: HF_TOKEN environment variable is not set.")
    print("Get a token at https://huggingface.co/settings/tokens")
    print('Then run: export HF_TOKEN="hf_..."')
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent / "generated-badges"
OUTPUT_DIR.mkdir(exist_ok=True)

# Sample goals with tailored prompts for badge-style icons
GOALS = [
    {
        "name": "run-100-miles",
        "prompt": (
            "A flat-design achievement badge icon for running 100 miles. "
            "Minimalist circular medal with running shoes and a road trail. "
            "Vibrant gradient background, gold and teal colors. "
            "Clean vector style, no text, dark background, centered composition."
        ),
    },
    {
        "name": "pass-ai-102-exam",
        "prompt": (
            "A flat-design achievement badge icon for passing an AI certification exam. "
            "Minimalist circular medal with a brain and circuit board pattern. "
            "Vibrant gradient background, purple and electric blue colors. "
            "Clean vector style, no text, dark background, centered composition."
        ),
    },
    {
        "name": "do-20-pullups",
        "prompt": (
            "A flat-design achievement badge icon for doing 20 pull-ups in a row. "
            "Minimalist circular medal with a strong arm flexing on a pull-up bar. "
            "Vibrant gradient background, orange and red colors. "
            "Clean vector style, no text, dark background, centered composition."
        ),
    },
]

MODEL = "black-forest-labs/FLUX.1-schnell"


def main():
    client = InferenceClient(provider="fal-ai", api_key=HF_TOKEN)

    for goal in GOALS:
        filename = f"{goal['name']}.png"
        output_path = OUTPUT_DIR / filename
        print(f"Generating: {goal['name']}...")

        try:
            image = client.text_to_image(
                goal["prompt"],
                model=MODEL,
            )
            image.save(output_path)
            print(f"  Saved to {output_path}")
        except Exception as e:
            print(f"  Error generating {goal['name']}: {e}")

    print("\nDone! Check generated images in:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
