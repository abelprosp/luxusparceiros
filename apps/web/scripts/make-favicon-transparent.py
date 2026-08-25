from PIL import Image
from pathlib import Path


def make_transparent(src: Path, dest: Path, size: int | None = None) -> None:
    img = Image.open(src).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            is_dark = r < 40 and g < 40 and b < 55
            is_blueish = b > r + 12 and b > g + 12 and b > 50
            if is_dark and not is_blueish:
                pixels[x, y] = (r, g, b, 0)
            elif is_dark and b < 70 and max(r, g) < 25:
                pixels[x, y] = (r, g, b, 0)

    if size:
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ox = (size - img.size[0]) // 2
        oy = (size - img.size[1]) // 2
        canvas.paste(img, (ox, oy), img)
        img = canvas

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    print(f"Wrote {dest} ({img.size[0]}x{img.size[1]})")


base = Path(r"C:\Users\Usuário\Downloads\Thomas\PROJETOS\Luxus Parceiros\apps\web")
src_globe = base / "src" / "assets" / "logos" / "favicon-globe.png"
src_icon = base / "src" / "app" / "icon.png"
source = src_globe if src_globe.exists() else src_icon

# Work on a copy in memory first: load original with black bg from icon if globe was already processed
# Prefer the app icon original (known black bg mark-only)
source = src_icon

make_transparent(source, base / "src" / "app" / "icon.png", size=256)
make_transparent(source, base / "src" / "app" / "apple-icon.png", size=180)
make_transparent(source, base / "src" / "assets" / "logos" / "favicon-globe.png", size=256)

public = base / "public"
public.mkdir(exist_ok=True)
make_transparent(source, public / "icon.png", size=256)
make_transparent(source, public / "favicon.png", size=32)

ico = Image.open(public / "icon.png").convert("RGBA")
ico.save(public / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("Wrote public/favicon.ico")
