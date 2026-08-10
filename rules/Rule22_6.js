const { createDiagnostic, createDiagnosticError } = require("../utils/helper");

const fileDecl = /\bFILE\s*\*\s*([a-zA-Z_]\w*)/;
const fopenAssign = /\b([a-zA-Z_]\w*)\s*=\s*fopen\s*\(/;
const fcloseCall = /\bfclose\s*\(\s*([a-zA-Z_]\w*)\s*\)/;

module.exports = {

    id: "22.6",
    scope: "document",
    title: "The value of a pointer to a FILE shall not be used after the associated stream has been closed",

    check(context) {
        const diagnostics = [];
        const lines = context.lines;

        let braceDepth = 0;
        let filePointers = new Set(); // known FILE* variable names in current scope
        let closed = new Set();       // subset of filePointers that are currently closed

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];

            for (const ch of line) {
                if (ch === "{") braceDepth++;
                else if (ch === "}") braceDepth--;
            }
            if (braceDepth <= 0) {
                if (filePointers.size) filePointers.clear();
                if (closed.size) closed.clear();
                continue;
            }

            const declMatch = line.match(fileDecl);
            if (declMatch) {
                filePointers.add(declMatch[1]);
            }

            const openMatch = line.match(fopenAssign);
            if (openMatch) {
                filePointers.add(openMatch[1]);
                closed.delete(openMatch[1]); // reopened - no longer stale
            }

            const closeMatch = line.match(fcloseCall);
            if (closeMatch && filePointers.has(closeMatch[1])) {
                closed.add(closeMatch[1]);
                continue; // the fclose() call itself is not a misuse
            }

            // fast path: nothing pending, skip the per-variable scan
            if (closed.size === 0) continue;

            for (const varName of closed) {
                const match = new RegExp(`\\b${varName}\\b`).exec(line);
                if (!match) continue;

                diagnostics.push(
                    createDiagnosticError(
                        lineNumber,
                        match.index,
                        match.index + varName.length,
                        "22.6",
                        `'${varName}' is used after its associated stream was closed`
                    )
                );
                closed.delete(varName); // flag once, not on every subsequent line
            }
        }

        return diagnostics;
    }
};