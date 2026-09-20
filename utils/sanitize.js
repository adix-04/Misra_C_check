// Cheap, single-line sanitizer for the fast per-keystroke line-rule path.
// Blanks out string/char literal contents and same-line comments, replacing
// characters with spaces so every index/position is preserved exactly.
// Known limitation: has no memory of previous lines, so it cannot tell
// whether THIS line starts already inside a block comment opened earlier
// in the file. If a /* opened on this same line never closes on this same
// line, it blanks the rest of the line as a safe fallback (better to under-
// scan than to false-positive on commented-out code).
function sanitizeLine(line) {
    let out = "";
    const n = line.length;
    let i = 0;

    while (i < n) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"' || ch === "'") {
            const quote = ch;
            out += " ";
            i++;
            while (i < n && line[i] !== quote) {
                if (line[i] === "\\" && i + 1 < n) {
                    out += "  ";
                    i += 2;
                    continue;
                }
                out += " ";
                i++;
            }
            if (i < n) { out += " "; i++; }
            continue;
        }

        if (ch === "/" && next === "/") {
            out += " ".repeat(n - i);
            i = n;
            continue;
        }

        if (ch === "/" && next === "*") {
            const closeIdx = line.indexOf("*/", i + 2);
            if (closeIdx !== -1) {
                out += " ".repeat(closeIdx + 2 - i);
                i = closeIdx + 2;
            } else {
                out += " ".repeat(n - i); // doesn't close on this line - blank the rest
                i = n;
            }
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

// Full multi-line-aware sanitizer for document-scope rules and the full
// (open/switch/debounced) scan path. Same idea as Rule3_1's own walker,
// but instead of collecting diagnostics it blanks comment/string interiors
// to spaces - preserving length AND every newline, so line/column math
// downstream (in every existing rule) stays exactly correct.
function sanitizeText(text) {
    const out = [];
    const n = text.length;
    let i = 0;

    while (i < n) {
        const ch = text[i];
        const next = text[i + 1];

        if (ch === '"' || ch === "'") {
            const quote = ch;
            out.push(" ");
            i++;
            while (i < n && text[i] !== quote) {
                if (text[i] === "\\" && i + 1 < n) {
                    out.push(text[i] === "\n" ? "\n" : " ");
                    i++;
                    out.push(text[i] === "\n" ? "\n" : " ");
                    i++;
                    continue;
                }
                out.push(text[i] === "\n" ? "\n" : " ");
                i++;
            }
            if (i < n) { out.push(" "); i++; }
            continue;
        }

        if (ch === "/" && next === "/") {
            while (i < n && text[i] !== "\n") { out.push(" "); i++; }
            continue; // leave the newline itself for the next loop iteration
        }

        if (ch === "/" && next === "*") {
            out.push(" ", " ");
            i += 2;
            while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
                out.push(text[i] === "\n" ? "\n" : " ");
                i++;
            }
            if (i < n) { out.push(" ", " "); i += 2; }
            continue;
        }

        out.push(ch);
        i++;
    }

    return out.join("");
}

module.exports = { sanitizeLine, sanitizeText };