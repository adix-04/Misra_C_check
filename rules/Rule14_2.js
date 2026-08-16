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

// split a clause list on top-level ";" or "," - ignoring any inside nested () or []
function splitTopLevel(text, separator) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "(" || ch === "[") depth++;
        else if (ch === ")" || ch === "]") depth--;
        else if (ch === separator && depth === 0) {
            parts.push(text.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(text.slice(start));
    return parts;
}

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split("\n").length - 1;
    const column = index - before.lastIndexOf("\n") - 1;
    return { line, column };
}

const TYPES = "uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|int|char|float|double|bool_t|size_t";
const declInit = new RegExp(`^\\s*(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\s*=`);
const plainAssign = /^\s*([a-zA-Z_]\w*)\s*=(?!=)/;
const incDecTarget = /(\+\+|--)\s*([a-zA-Z_]\w*)|([a-zA-Z_]\w*)\s*(\+\+|--)/g;
const compoundAssignTarget = /\b([a-zA-Z_]\w*)\s*(?:\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=)/g;
const bareAssignTarget = /\b([a-zA-Z_]\w*)\s*=(?!=)/g;

module.exports = {

    id: "14.2",
    scope: "document",
    title: "A for loop shall be well-formed",

    check(context) {
        const diagnostics = [];
        const text = context.text;

        const forRegex = /\bfor\s*\(/g;
        let match;

        while ((match = forRegex.exec(text)) !== null) {
            const openParen = match.index + match[0].length - 1;
            const closeParen = findMatchingClose(text, openParen, "(", ")");
            if (closeParen === -1) continue;

            const header = text.slice(openParen + 1, closeParen);
            const clauses = splitTopLevel(header, ";");
            if (clauses.length !== 3) continue; // malformed - not our job to catch

            const [clause1, clause2, clause3] = clauses;
            const { line: forLine, column: forColumn } = lineAndColumn(text, match.index);

            const c1 = clause1.trim();
            if (c1 === "") continue; // exception: empty clauses permitted (e.g. for(;;))

            // ---- loop counter identification ----
            const declarators = splitTopLevel(c1, ",");
            if (declarators.length > 1) {
                diagnostics.push(
                    createDiagnostic(forLine, forColumn, forColumn + 3, "14.2",
                        "There shall only be one loop counter in a for loop")
                );
            }

            const firstDeclarator = declarators[0];
            const declMatch = firstDeclarator.match(declInit) || firstDeclarator.match(plainAssign);
            if (!declMatch) continue; // can't determine the counter - skip rather than guess

            const counter = declMatch[1];

            // ---- second clause should reference the counter ----
            if (!new RegExp(`\\b${counter}\\b`).test(clause2)) {
                diagnostics.push(
                    createDiagnostic(forLine, forColumn, forColumn + 3, "14.2",
                        `Second clause does not use the loop counter '${counter}'`)
                );
            }

            // ---- third clause should modify only the counter ----
            const thirdTargets = new Set();
            let m;
            incDecTarget.lastIndex = 0;
            while ((m = incDecTarget.exec(clause3)) !== null) thirdTargets.add(m[2] || m[3]);
            compoundAssignTarget.lastIndex = 0;
            while ((m = compoundAssignTarget.exec(clause3)) !== null) thirdTargets.add(m[1]);
            bareAssignTarget.lastIndex = 0;
            while ((m = bareAssignTarget.exec(clause3)) !== null) thirdTargets.add(m[1]);

            for (const target of thirdTargets) {
                if (target !== counter) {
                    diagnostics.push(
                        createDiagnostic(forLine, forColumn, forColumn + 3, "14.2",
                            `Third clause shall only modify the loop counter '${counter}', not '${target}'`)
                    );
                }
            }

            // ---- find the loop body ----
            let bodyStart, bodyEnd;
            let i = closeParen + 1;
            while (i < text.length && /\s/.test(text[i])) i++;
            if (text[i] === "{") {
                bodyStart = i + 1;
                bodyEnd = findMatchingClose(text, i, "{", "}");
                if (bodyEnd === -1) continue;
            } else {
                bodyStart = i;
                bodyEnd = text.indexOf(";", i);
                if (bodyEnd === -1) continue;
            }

            const body = text.slice(bodyStart, bodyEnd);

            // ---- counter shall not be modified in the loop body ----
            const bodyModRegex = new RegExp(
                `(\\+\\+\\s*${counter}\\b)|(\\b${counter}\\s*\\+\\+)|(--\\s*${counter}\\b)|(\\b${counter}\\s*--)|(\\b${counter}\\s*(?:\\+=|-=|\\*=|/=|%=|&=|\\|=|\\^=|<<=|>>=|=(?!=)))`,
                "g"
            );
            let bm;
            while ((bm = bodyModRegex.exec(body)) !== null) {
                const absoluteIndex = bodyStart + bm.index;
                const { line, column } = lineAndColumn(text, absoluteIndex);
                diagnostics.push(
                    createDiagnostic(line, column, column + bm[0].length, "14.2",
                        `Loop counter '${counter}' shall not be modified in the for loop body`)
                );
            }
        }

        return diagnostics;
    }
};