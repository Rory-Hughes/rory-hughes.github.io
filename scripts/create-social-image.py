"""Render a simple text-based social card from public portfolio facts (Pillow)."""
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
profile = json.loads((ROOT / "src/content/profile/rory.json").read_text(encoding="utf-8"))
if profile["publicationState"] != "public":
    raise ValueError("The social card requires an explicitly public profile.")
font_directory = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"


def font(size, bold=False):
    return ImageFont.truetype(str(font_directory / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)


image = Image.new("RGB", (1200, 630), "#f7f8fc")
draw = ImageDraw.Draw(image)
draw.rectangle((0, 0, 16, 630), fill="#3049d8")
draw.rounded_rectangle((64, 54, 140, 130), radius=8, fill="#3049d8")
draw.text((78, 67), "RH", font=font(35, True), fill="white")
draw.text((160, 72), "SOFTWARE DEVELOPMENT", font=font(24, True), fill="#526176")
draw.text((60, 170), profile["displayName"], font=font(88, True), fill="#182334")
draw.text((64, 293), "Kotlin  /  C#  /  Python", font=font(46, True), fill="#3049d8")
draw.text((64, 387), "Android and Windows applications.", font=font(32), fill="#182334")
draw.text((64, 436), "Real workflows. Thoughtful engineering.", font=font(32), fill="#526176")
draw.line((64, 520, 1136, 520), fill="#dce1ec", width=2)
draw.text((64, 545), "rory-hughes.github.io", font=font(26, True), fill="#263fc6")
draw.text((720, 545), "Saint John, New Brunswick", font=font(25), fill="#526176")
output = ROOT / "public/social/portfolio-preview.png"
output.parent.mkdir(parents=True, exist_ok=True)
image.save(output, optimize=True)
print("Created " + str(output) + " (1200 x 630).")
