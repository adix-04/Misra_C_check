const { createDiagnostic } = require("../utils/helper");

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

function scanBlockInterior(interior, interiorStart, diagnostics, fullText) {
    let i = 0;
    while (i < interior.length - 1) {
        const pair = interior.slice(i, i + 2);
        if (pair === "/*" || pair === "//") {
            const { line, column } = lineAndColumn(fullText, interiorStart + i);
            diagnostics.push(
                createDiagnostic(line, column, column + 2, "3.1",
                    `The character sequence '${pair}' shall not be used within a comment`)
            );
            i += 2;
        } else {
            i += 1;
        }
    }
}

function scanLineInterior(interior, interiorStart, diagnostics, fullText) {
    let i = 0;
    while (i < interior.length - 1) {
        if (interior.slice(i, i + 2) === "/*") {
            const { line, column } = lineAndColumn(fullText, interiorStart + i);
            diagnostics.push(
                createDiagnostic(line, column, column + 2, "3.1",
                    "The character sequence '/*' shall not be used within a comment")
            );
            i += 2;
        } else {
            i += 1;
        }
    }
}

module.exports = {

    id: "3.1",
    scope: "document",
    title: "The character sequences /* and // shall not be used within a comment",

    check(context) {
        const diagnostics = [];
        const text = context.rawText;
        const n = text.length;
        let i = 0;

        while (i < n) {
            const ch = text[i];
            const next = text[i + 1];

            if (ch === '"') {
                i++;
                while (i < n && text[i] !== '"') {
                    if (text[i] === "\\") i++;
                    i++;
                }
                i++;
                continue;
            }

            if (ch === "'") {
                i++;
                while (i < n && text[i] !== "'") {
                    if (text[i] === "\\") i++;
                    i++;
                }
                i++;
                continue;
            }

            if (ch === "/" && next === "*") {
                const interiorStart = i + 2;
                let end = text.indexOf("*/", interiorStart);
                if (end === -1) {
                    scanBlockInterior(text.slice(interiorStart), interiorStart, diagnostics, text);
                    i = n;
                } else {
                    scanBlockInterior(text.slice(interiorStart, end), interiorStart, diagnostics, text);
                    i = end + 2;
                }
                continue;
            }

            if (ch === "/" && next === "/") {
                const interiorStart = i + 2;
                let end = text.indexOf("\n", interiorStart);
                if (end === -1) end = n;
                scanLineInterior(text.slice(interiorStart, end), interiorStart, diagnostics, text);
                i = end;
                continue;
            }

            i++;
        }

        return diagnostics;
    }
};