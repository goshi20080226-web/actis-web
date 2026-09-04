/* ACTIS OUD2 parser conflict marker cleanup */

function normalizeColorValue(value) {
  const color = String(value || "").trim().replace(/^0x/i, "")
  if (/^[0-9A-Fa-f]{8}$/.test(color)) {
    return "#" + color.slice(6, 8) + color.slice(4, 6) + color.slice(2, 4)
  }
  if (/^[0-9A-Fa-f]{6}$/.test(color)) {
    return "#" + color
  }
  return ""
}

// NOTE: The previous file contained unresolved Git conflict markers.
// Keep the parser valid while preserving the OUD2 type-color rule:
// JikokuhyouMojiColor = text color, 8-digit BGR 00BBGGRR.
export { normalizeColorValue }
