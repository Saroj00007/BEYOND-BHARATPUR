from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfbase.pdfmetrics import stringWidth


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "YatraAI_Project_Documentation.pdf"
PAGE_W, PAGE_H = A4
BLACK = "#000000"
GRAY = "#444444"


def wrap_text(value: str, max_width: float, font: str, size: float):
    lines = []
    for paragraph in value.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split()
        line = ""
        for word in words:
            candidate = word if not line else f"{line} {word}"
            if stringWidth(candidate, font, size) <= max_width:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def draw_paragraph(canvas: Canvas, value: str, x: float, y: float,
                   width: float, size: float = 10, leading: float = 14,
                   color: str = BLACK):
    lines = wrap_text(value, width, "Helvetica", size)
    canvas.setFillColor(color)
    canvas.setFont("Helvetica", size)
    for line in lines:
        canvas.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(canvas: Canvas, items: list[str], x: float, y: float,
                 width: float, size: float = 10, leading: float = 14,
                 gap: float = 6):
    for item in items:
        canvas.setFillColor(BLACK)
        canvas.setFont("Helvetica", size)
        canvas.drawString(x, y, "•")
        lines = wrap_text(item, width - 16, "Helvetica", size)
        for index, line in enumerate(lines):
            canvas.drawString(x + 16, y - index * leading, line)
        y -= max(1, len(lines)) * leading + gap
    return y


def heading(canvas: Canvas, value: str, x: float, y: float):
    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(x, y, value)
    return y - 20


def build_pdf():
    canvas = Canvas(str(OUTPUT), pagesize=A4)
    canvas.setTitle("YatraAI Project Documentation")

    margin = 54
    content_width = PAGE_W - margin * 2
    y = PAGE_H - 62

    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica-Bold", 20)
    canvas.drawString(margin, y, "YatraAI: Discover Bharatpur")
    y -= 28
    canvas.setFont("Helvetica", 10.5)
    canvas.drawString(margin, y, "A simple tourism discovery application for Bharatpur, Nepal.")
    y -= 34

    y = heading(canvas, "Problem", margin, y)
    y = draw_bullets(
        canvas,
        [
            "Information about tourism places in Bharatpur is spread across different sources, so visitors may not easily find all the places they can visit.",
            "Popular attractions are easier to find, but quieter places and local experiences are harder to discover.",
            "Visitors also need practical information such as food, hotels, health facilities, police offices, and transport references near the places they visit.",
            "It is difficult to plan a route with useful stops when the distance and travel time are not shown together.",
        ],
        margin,
        y,
        content_width,
    )
    y -= 8

    y = heading(canvas, "Our Approach to Solve the Problem", margin, y)
    y = draw_paragraph(
        canvas,
        "We created one place where visitors can search and explore Bharatpur. Tourism places are arranged into zones so that users can understand which part of the city or surrounding area they are viewing. Service information is grouped by nearby hubs to make it easier to find useful facilities.",
        margin,
        y,
        content_width,
    )
    y -= 10
    y = draw_paragraph(
        canvas,
        "The route finder allows a user to enter an origin and destination, choose a travel mood, select interests, and choose how much of a detour is acceptable. The system checks the route and returns places that fit the selected journey. It also shows the route distance, estimated travel time, practical tips, and source information. If a place cannot be checked properly, it is not shown as a confirmed recommendation.",
        margin,
        y,
        content_width,
    )
    y -= 18

    y = heading(canvas, "Features", margin, y)
    y = draw_bullets(
        canvas,
        [
            "Landing page that introduces Bharatpur and gives quick access to the map and route finder.",
            "Interactive tourism map with 21 destinations arranged into five zones.",
            "Search for places, zones, categories, and services from the map.",
            "Filters for all places, popular places, nearby places, food, stays, health, police, and transport.",
            "Place details showing activities, ward, approximate distance, direction, nearby places, food, stays, health, security, and service information.",
            "Service directory with 44 service listings grouped into approximate service hubs.",
            "Route finder with origin, destination, travel mood, interests, and detour options.",
            "Route results with road distance, estimated drive time, route information, tourism places, hotels and stays, other services, tips, and sources.",
        ],
        margin,
        y,
        content_width,
        size=9.5,
        leading=13,
        gap=4,
    )
    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(margin, 34, "YatraAI | Bharatpur, Nepal")
    canvas.drawRightString(PAGE_W - margin, 34, "Project documentation")
    canvas.showPage()
    canvas.save()


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT)
