const { createDiagnostic } = require("../utils/helper");

function findMatchingClose(text, openIndex, openChar, closeChar) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        if (text[i] === openChar) depth++;
        else if (text[i] === closeChar) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

// find every "case ... :" / "default :" label at brace-depth 0 within
// switchBodyText (i.e. belonging to THIS switch, not a nested one)
function findTopLevelLabels(text) {
    const labels = [];
    let depth = 0, pdepth = 0;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        if (ch === "{") { depth++; i++; continue; }
        if (ch === "}") { depth--; i++; continue; }
        if (ch === "(") { pdepth++; i++; continue; }
        if (ch === ")") { pdepth--; i++; continue; }

        if (depth === 0) {
            if (/^case\b/.test(text.slice(i))) {
                let j = i + 4;
                let localPdepth = 0;
                while (j < text.length) {
                    if (text[j] === "(") localPdepth++;
                    else if (text[j] === ")") localPdepth--;
                    else if (text[j] === ":" && localPdepth === 0) break;
                    j++;
                }
                labels.push({ start: i, colonIndex: j });
                i = j + 1;
                continue;
            }
            if (/^default\b/.test(text.slice(i))) {
                let j = i + 7;
                while (j < text.length && text[j] !== ":") j++;
                labels.push({ start: i, colonIndex: j });
                i = j + 1;
                continue;
            }
        }
        i++;
    }
    return labels;
}

// split raw statement text into top-level chunks: a chunk ends at a
// top-level ";" or when a top-level "{...}" block closes back to depth 0.
function splitStatements(text) {
    const chunks = [];
    let depth = 0, pdepth = 0;
    let start = 0;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        if (ch === "(") pdepth++;
        else if (ch === ")") pdepth--;
        else if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                chunks.push(text.slice(start, i + 1));
                start = i + 1;
            }
        } else if (ch === ";" && depth === 0 && pdepth === 0) {
            chunks.push(text.slice(start, i + 1));
            start = i + 1;
        }
        i++;
    }
    const rest = text.slice(start).trim();
    if (rest) chunks.push(rest);
    return chunks.map(c => c.trim()).filter(c => c.length > 0);
}

const bareBreak = /^break\s*;$/;

// returns true if the clause's statement text is compliant: last top-level
// statement is an unconditional "break;", or the whole clause is a single
// compound block whose own last statement is (recursively).
function endsWithUnconditionalBreak(clauseText) {
    const trimmed = clauseText.trim();
    if (trimmed === "") return true; // no statements - fallthrough group, permitted

    const chunks = splitStatements(trimmed);
    if (chunks.length === 0) return false; // shouldn't happen given the trim check above

    const last = chunks[chunks.length - 1];

    if (bareBreak.test(last)) return true;

    // "switch-clause is a compound statement" - the ENTIRE clause is one bare { ... } block
    if (chunks.length === 1 && last.startsWith("{") && last.endsWith("}")) {
        const inner = last.slice(1, -1);
        return endsWithUnconditionalBreak(inner);
    }

    return false;
}

module.exports = {

    id: "16.3",
    scope: "document",
    title: "An unconditional break statement shall terminate every switch-clause",

    check(context) {
        const diagnostics = [];
        const text = context.text;

        const switchRegex = /\bswitch\s*\(/g;
        let match;

        while ((match = switchRegex.exec(text)) !== null) {
            const openParen = match.index + match[0].length - 1;
            const closeParen = findMatchingClose(text, openParen, "(", ")");
            if (closeParen === -1) continue;

            let i = closeParen + 1;
            while (i < text.length && /\s/.test(text[i])) i++;
            if (text[i] !== "{") continue; // no braces on the switch body - not handled

            const bodyStart = i + 1;
            const bodyEnd = findMatchingClose(text, i, "{", "}");
            if (bodyEnd === -1) continue;

            const body = text.slice(bodyStart, bodyEnd);
            const labels = findTopLevelLabels(body);

            for (let k = 0; k < labels.length; k++) {
                const clauseStart = labels[k].colonIndex + 1;
                const clauseEnd = k + 1 < labels.length ? labels[k + 1].start : body.length;
                const clauseText = body.slice(clauseStart, clauseEnd);

                if (!endsWithUnconditionalBreak(clauseText)) {
                    const absoluteLabelStart = bodyStart + labels[k].start;
                    const { line, column } = lineAndColumn(text, absoluteLabelStart);
                    const labelWord = /^default\b/.test(body.slice(labels[k].start)) ? "default" : "case";

                    diagnostics.push(
                        createDiagnostic(
                            line, column, column + labelWord.length, "16.3",
                            `Switch-clause '${labelWord}' does not end with an unconditional break statement`
                        )
                    );
                }
            }
        }

        return diagnostics;
    }
};