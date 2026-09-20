const { createDiagnostic } = require("../utils/helper");

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

module.exports = {

    id: "4.1",
    scope: "document",
    title: "Octal and hexadecimal escape sequences shall be terminated",

    check(context) {
        const diagnostics = [];
        const text = context.rawText; // needs actual literal content, not the sanitized/blanked text
        const n = text.length;
        let i = 0;

        while (i < n) {
            const ch = text[i];
            const next = text[i + 1];

            // skip comments so escape-like text inside them is never inspected
            if (ch === "/" && next === "/") {
                while (i < n && text[i] !== "\n") i++;
                continue;
            }
            if (ch === "/" && next === "*") {
                const end = text.indexOf("*/", i + 2);
                i = end === -1 ? n : end + 2;
                continue;
            }

            if (ch === '"' || ch === "'") {
                const quote = ch;
                i++;

                while (i < n && text[i] !== quote) {
                    if (text[i] === "\\") {
                        const escapeStart = i;
                        i++; // past backslash
                        if (i >= n) break;
                        const escChar = text[i];

                        if (escChar === "x" || escChar === "X") {
                            i++; // past 'x'
                            let digits = 0;
                            while (i < n && /[0-9a-fA-F]/.test(text[i])) { i++; digits++; }
                            if (digits > 0) {
                                checkTerminator(text, i, quote, escapeStart, diagnostics);
                            }
                        } else if (/[0-7]/.test(escChar)) {
                            let digits = 0;
                            while (i < n && digits < 3 && /[0-7]/.test(text[i])) { i++; digits++; }
                            checkTerminator(text, i, quote, escapeStart, diagnostics);
                        } else {
                            i++; // ordinary single-char escape (\n, \t, \\, \", \', etc.) - not this rule's concern
                        }
                        continue;
                    }
                    i++;
                }
                if (i < n) i++; // consume closing quote
                continue;
            }

            i++;
        }

        return diagnostics;

        function checkTerminator(text, indexAfterDigits, quote, escapeStart, diagnostics) {
            const nextChar = text[indexAfterDigits];
            if (nextChar === undefined) return; // unterminated literal - not this rule's job
            if (nextChar === quote) return;      // terminated by end of literal - compliant
            if (nextChar === "\\") return;       // terminated by start of another escape - compliant

            const { line, column } = lineAndColumn(text, escapeStart);
            const escapeText = text.slice(escapeStart, indexAfterDigits);
            diagnostics.push(
                createDiagnostic(line, column, column + escapeText.length, "4.1",
                    `Escape sequence '${escapeText}' is not terminated by another escape sequence or the end of the literal`)
            );
        }
    }
};