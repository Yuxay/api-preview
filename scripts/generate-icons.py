"""
Generate PNG app icons from SVG source using Pillow.
Run: python scripts/generate-icons.py

Requires: pip install pillow
"""
from PIL import Image, ImageDraw

def draw_thick_line(draw, p1, p2, color, width):
    """Draw a thick line as a polygon with perpendicular offset."""
    import math
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.sqrt(dx*dx + dy*dy)
    if length < 1:
        return
    px = -dy / length
    py = dx / length
    half = width / 2
    points = [
        (p1[0] + px * half, p1[1] + py * half),
        (p1[0] - px * half, p1[1] - py * half),
        (p2[0] - px * half, p2[1] - py * half),
        (p2[0] + px * half, p2[1] + py * half),
    ]
    draw.polygon(points, fill=color)

def rounded_rect(draw, xy, radius, fill):
    """Draw a filled rounded rectangle."""
    x0, y0, x1, y1 = xy
    try:
        draw.rounded_rectangle(xy, radius=radius, fill=fill)
    except AttributeError:
        r = radius
        draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
        draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
        draw.pieslice([x0, y0, x0+2*r, y0+2*r], 180, 270, fill=fill)
        draw.pieslice([x1-2*r, y0, x1, y0+2*r], 270, 360, fill=fill)
        draw.pieslice([x0, y1-2*r, x0+2*r, y1], 90, 180, fill=fill)
        draw.pieslice([x1-2*r, y1-2*r, x1, y1], 0, 90, fill=fill)

def generate_logo_icon(size=512, corner_radius=96):
    """Generate the ApiPreview app icon PNG."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background
    bg_color = (15, 23, 42, 255)  # #0f172a
    rounded_rect(draw, [0, 0, size-1, size-1], corner_radius, bg_color)

    # Colors
    accent_dim = (125, 211, 252, 255)   # #7dd3fc
    accent = (56, 189, 248, 255)        # #38bdf8

    # A monogram geometry (relative to 512x512)
    apex = (int(size * 0.5), int(size * 0.172))
    left_foot = (int(size * 0.328), int(size * 0.781))
    right_foot = (int(size * 0.672), int(size * 0.781))
    cross_left = (int(size * 0.398), int(size * 0.586))
    cross_right = (int(size * 0.602), int(size * 0.586))
    dot_center = (int(size * 0.5), int(size * 0.723))
    node1 = (int(size * 0.367), int(size * 0.641))
    node2 = (int(size * 0.633), int(size * 0.469))

    stroke_w = int(size * 0.0586)   # ~30px at 512
    cross_w = int(size * 0.0508)    # ~26px at 512
    dot_r = int(size * 0.0195)      # ~10px at 512
    node_r = int(size * 0.0098)     # ~5px at 512

    # Left stroke
    draw_thick_line(draw, apex, left_foot, accent_dim, stroke_w)
    # Right stroke
    draw_thick_line(draw, apex, right_foot, accent, stroke_w)
    # Crossbar
    draw_thick_line(draw, cross_left, cross_right, accent, cross_w)
    # Endpoint dot
    draw.ellipse([dot_center[0]-dot_r, dot_center[1]-dot_r,
                  dot_center[0]+dot_r, dot_center[1]+dot_r],
                 fill=(56, 189, 248, 217))
    # Small nodes
    draw.ellipse([node1[0]-node_r, node1[1]-node_r,
                  node1[0]+node_r, node1[1]+node_r],
                 fill=(125, 211, 252, 115))
    draw.ellipse([node2[0]-node_r, node2[1]-node_r,
                  node2[0]+node_r, node2[1]+node_r],
                 fill=(125, 211, 252, 115))

    return img

if __name__ == '__main__':
    import os
    brand_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'brand')
    os.makedirs(brand_dir, exist_ok=True)

    # 512x512 app icon
    img512 = generate_logo_icon(512, 96)
    img512.save(os.path.join(brand_dir, 'logo-icon-v2.png'), 'PNG')
    print(f'  logo-icon-v2.png ({img512.size})')

    # 256x256 (electron-builder minimum for Windows .ico)
    img256 = img512.resize((256, 256), Image.LANCZOS)
    img256.save(os.path.join(brand_dir, 'logo-icon-v2-256.png'), 'PNG')
    print(f'  logo-icon-v2-256.png ({img256.size})')

    # 32x32 favicon / minimal mark
    img32 = img512.resize((32, 32), Image.LANCZOS)
    img32.save(os.path.join(brand_dir, 'logo-mark-minimal.png'), 'PNG')
    print(f'  logo-mark-minimal.png ({img32.size})')

    # ICO for Windows (multi-resolution)
    sizes_ico = [256, 128, 64, 48, 32, 16]
    icons = []
    for s in sizes_ico:
        r = img512.resize((s, s), Image.LANCZOS)
        if r.mode != 'RGBA':
            r = r.convert('RGBA')
        icons.append(r)
    icons[0].save(
        os.path.join(brand_dir, 'logo-icon-v2.ico'),
        format='ICO',
        sizes=[(s, s) for s in sizes_ico],
        append_images=icons[1:]
    )
    print(f'  logo-icon-v2.ico ({sizes_ico})')

    # Copy to build/ for electron-builder
    build_dir = os.path.join(os.path.dirname(brand_dir), 'build')
    os.makedirs(build_dir, exist_ok=True)
    import shutil
    shutil.copy(
        os.path.join(brand_dir, 'logo-icon-v2.ico'),
        os.path.join(build_dir, 'icon.ico')
    )
    print('  build/icon.ico (copied)')

    print('Done — all icons generated.')
