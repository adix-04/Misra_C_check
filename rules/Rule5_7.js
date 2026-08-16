const { createDiagnostic } = require("../utils/helper");

// finds the index of the matching closing brace for the '{' at openIndex,
// scanning across the whole document text (so multi-line bodies work)
function findMatchingClose(text, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function toLineCol(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const col = index - before.lastIndexOf("\n") - 1;
    return { line, col };
}

// strip // line comments only - cheap, and the common case; block comments
// and string literals containing "struct"/"union"/"enum" are a known gap
function stripLineComments(text) {
    return text.split("\n").map(line => {
        const idx = line.indexOf("//");
        return idx === -1 ? line : line.slice(0, idx);
    }).join("\n");
}

const tagOccurrence = /\b(struct|union|enum)\s+([a-zA-Z_]\w*)/g;

module.exports = {

    id: "5.7",
    scope: "document",
    title: "A tag name shall be a unique identifier",

    check(context) {
        const diagnostics = [];
        const text = stripLineComments(context.text);

        const known = new Map(); // tagName -> { keyword, bodySignature|null, line }

        let match;
        tagOccurrence.lastIndex = 0;
        while ((match = tagOccurrence.exec(text)) !== null) {
            const keyword = match[1];
            const tagName = match[2];
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            // look ahead past whitespace for an opening '{' - a defining occurrence
            let i = matchEnd;
            while (i < text.length && /\s/.test(text[i])) i++;
            const hasBody = text[i] === "{";

            let bodySignature = null;
            if (hasBody) {
                const closeIndex = findMatchingClose(text, i);
                if (closeIndex !== -1) {
                    bodySignature = text.slice(i + 1, closeIndex).replace(/\s+/g, " ").trim();
                }
            }

            const existing = known.get(tagName);

            if (!existing) {
                known.set(tagName, { keyword, bodySignature, line: toLineCol(text, matchStart).line });
                continue;
            }

            if (existing.keyword !== keyword) {
                const { line, col } = toLineCol(text, matchStart);
                diagnostics.push(
                    createDiagnostic(
                        line, col, col + match[0].length, "5.7",
                        `Tag '${tagName}' was previously declared as '${existing.keyword}', not '${keyword}'`
                    )
                );
                continue;
            }

            if (hasBody) {
                if (existing.bodySignature === null) {
                    // was referenced before but never defined - now completing it
                    existing.bodySignature = bodySignature;
                } else if (existing.bodySignature !== bodySignature) {
                    const { line, col } = toLineCol(text, matchStart);
                    diagnostics.push(
                        createDiagnostic(
                            line, col, col + match[0].length, "5.7",
                            `Tag '${tagName}' redeclared with a different type (first declared at line ${existing.line + 1})`
                        )
                    );
                }
            }
        }

        return diagnostics;
    }
};