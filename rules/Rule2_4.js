const { createDiagnostic } = require("../utils/helper");

// every "struct NAME" / "union NAME" / "enum NAME" occurrence in the file
const TAG_PATTERN = "\\b(struct|union|enum)\\s+([a-zA-Z_]\\w*)\\b";

// offsets of the first character of every line - built once per scan
function buildLineStarts(text) {
    const starts = [0];
    let i = -1;
    while ((i = text.indexOf("\n", i + 1)) !== -1) starts.push(i + 1);
    return starts;
}

// binary search instead of re-splitting the whole file for every diagnostic
function locate(starts, index) {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= index) lo = mid;
        else hi = mid - 1;
    }
    return { line: lo, column: index - starts[lo] };
}

// first non-space character at or after `from`
function nextNonSpace(text, from) {
    let i = from;
    while (i < text.length && /\s/.test(text[i])) i++;
    return text[i];
}

function findUnusedTags(context) {
    const diagnostics = [];
    const text = typeof context.text === "string" ? context.text : (context.lines || []).join("\n");

    // tagName -> { definitions: [...], uses: number }
    const tags = new Map();
    const tagRegex = new RegExp(TAG_PATTERN, "g"); // fresh regex per scan - no shared lastIndex state
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        const name = match[2];
        const afterName = match.index + match[0].length;
        const following = nextNonSpace(text, afterName);

        let entry = tags.get(name);
        if (!entry) {
            entry = { definitions: [], uses: 0 };
            tags.set(name, entry);
        }

        if (following === "{") {
            entry.definitions.push({ index: match.index, length: match[0].length });
        } else if (following === ";") {
            // bare forward declaration ("struct foo;") - neither a definition nor a use
        } else {
            entry.uses++; // "struct foo x;", "struct foo *p", "sizeof(struct foo)", etc.
        }
    }

    let lineStarts = null; // only built if there is something to report
    for (const [name, entry] of tags) {
        if (entry.uses > 0) continue;
        for (const def of entry.definitions) {
            if (!lineStarts) lineStarts = buildLineStarts(text);
            const { line, column } = locate(lineStarts, def.index);
            diagnostics.push(
                createDiagnostic(line, column, column + def.length, "2.4",
                    `Tag '${name}' is declared but never used`)
            );
        }
    }

    return diagnostics;
}

module.exports = {

    id: "2.4",
    scope: "document",
    title: "A project should not contain unused tag declarations",

    check(context) {
        // this rule can never take the rest of the checker down with it
        try {
            return findUnusedTags(context);
        } catch (err) {
            console.error("[misra] rule 2.4 failed and was skipped:", err);
            return [];
        }
    }
};