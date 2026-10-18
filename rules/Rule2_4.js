const { createDiagnostic } = require("../utils/helper");

// every "struct NAME" / "union NAME" / "enum NAME" occurrence in the file
const tagRegex = /\b(struct|union|enum)\s+([a-zA-Z_]\w*)\b/g;

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

// what follows the tag name, ignoring whitespace
function nextNonSpace(text, from) {
    let i = from;
    while (i < text.length && /\s/.test(text[i])) i++;
    return text[i];
}

module.exports = {

    id: "2.4",
    scope: "document",
    title: "A project should not contain unused tag declarations",

    check(context) {
        const diagnostics = [];
        const text = context.text; // sanitized - comments/strings already blanked

        // tagName -> { definitions: [...], uses: number }
        const tags = new Map();
        let match;

        tagRegex.lastIndex = 0;
        while ((match = tagRegex.exec(text)) !== null) {
            const kind = match[1];
            const name = match[2];
            const afterName = match.index + match[0].length;
            const following = nextNonSpace(text, afterName);

            let entry = tags.get(name);
            if (!entry) {
                entry = { definitions: [], uses: 0 };
                tags.set(name, entry);
            }

            if (following === "{") {
                entry.definitions.push({ index: match.index, length: match[0].length, kind });
            } else if (following === ";") {
                // bare forward declaration ("struct foo;") - neither a definition nor a use
            } else {
                entry.uses++; // "struct foo x;", "struct foo *p", "sizeof(struct foo)", etc.
            }
        }

        for (const [name, entry] of tags) {
            if (entry.uses > 0) continue;
            for (const def of entry.definitions) {
                const { line, column } = lineAndColumn(text, def.index);
                diagnostics.push(
                    createDiagnostic(line, column, column + def.length, "2.4",
                        `Tag '${name}' is declared but never used`)
                );
            }
        }

        return diagnostics;
    }
};