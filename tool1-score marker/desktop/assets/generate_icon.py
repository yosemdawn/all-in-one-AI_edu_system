from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent
PNG_PATH = ROOT / "app-icon.png"
ICO_PATH = ROOT / "app.ico"


def build_icon(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    outer_margin = int(size * 0.08)
    card_left = outer_margin
    card_top = outer_margin
    card_right = size - outer_margin
    card_bottom = size - outer_margin
    radius = int(size * 0.16)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (card_left, card_top + int(size * 0.03), card_right, card_bottom + int(size * 0.03)),
        radius=radius,
        fill=(20, 30, 60, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(size * 0.05)))
    canvas.alpha_composite(shadow)

    draw.rounded_rectangle(
        (card_left, card_top, card_right, card_bottom),
        radius=radius,
        fill=(247, 250, 252, 255),
    )

    stripe_height = int(size * 0.18)
    draw.rounded_rectangle(
        (card_left, card_top, card_right, card_top + stripe_height),
        radius=radius,
        fill=(29, 78, 216, 255),
    )
    draw.rectangle(
        (card_left, card_top + stripe_height // 2, card_right, card_top + stripe_height),
        fill=(29, 78, 216, 255),
    )

    line_left = int(size * 0.22)
    line_right = int(size * 0.76)
    base_y = int(size * 0.38)
    line_gap = int(size * 0.12)
    line_width = max(2, size // 28)

    for index in range(3):
        y = base_y + index * line_gap
        draw.rounded_rectangle(
            (line_left, y, line_right, y + line_width),
            radius=line_width // 2,
            fill=(148, 163, 184, 255),
        )

    badge_center_x = int(size * 0.73)
    badge_center_y = int(size * 0.70)
    badge_radius = int(size * 0.15)
    draw.ellipse(
        (
            badge_center_x - badge_radius,
            badge_center_y - badge_radius,
            badge_center_x + badge_radius,
            badge_center_y + badge_radius,
        ),
        fill=(22, 163, 74, 255),
    )

    check = [
        (badge_center_x - int(size * 0.07), badge_center_y + int(size * 0.005)),
        (badge_center_x - int(size * 0.02), badge_center_y + int(size * 0.06)),
        (badge_center_x + int(size * 0.09), badge_center_y - int(size * 0.07)),
    ]
    draw.line(check, fill=(255, 255, 255, 255), width=max(4, size // 18), joint="curve")

    accent_width = int(size * 0.14)
    draw.rounded_rectangle(
        (
            int(size * 0.18),
            int(size * 0.58),
            int(size * 0.18) + accent_width,
            int(size * 0.58) + accent_width,
        ),
        radius=int(size * 0.04),
        fill=(251, 191, 36, 255),
    )

    return canvas


def main() -> None:
    image = build_icon(512)
    PNG_PATH.parent.mkdir(parents=True, exist_ok=True)
    image.save(PNG_PATH)
    image.save(ICO_PATH, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print(f"Generated {PNG_PATH} and {ICO_PATH}")


if __name__ == "__main__":
    main()
