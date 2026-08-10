const { createDiagnostic, createDiagnosticError } = require("../utils/helper");

const TYPES = "uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|int|char|float|double|bool_t";
const declNoInit = new RegExp(`\\b(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\s*;`);
const declWithInit = new RegExp(`\\b(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\s*=`);
const directAssign = /\b([a-zA-Z_]\w*)\s*=(?!=)/;

module.exports = {

    id: "9.1",
    scope: "document",
    title: "The value of an object with automatic storage duration shall not be read before it has been set",

    check(context) {
        const diagnostics = [];
        const lines = context.lines;

        let braceDepth = 0;
        let unset = new Map(); // varName -> declaration line, cleared on direct assignment or first flagged read
        let sawGoto = false;

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            const trimmed = line.trim();

            // track brace depth so state resets per function/block instead of
            // leaking "unset" variables across unrelated functions
            for (const ch of trimmed) {
                if (ch === "{") braceDepth++;
                else if (ch === "}") braceDepth--;
            }
            if (braceDepth <= 0) {
                if (unset.size) unset.clear();
                sawGoto = false;
                continue;
            }

            if (!sawGoto && /\bgoto\b/.test(trimmed)) {
                sawGoto = true; // widen the warning text below, don't try to model jumps
            }

            const noInitMatch = trimmed.match(declNoInit);
            if (noInitMatch) {
                unset.set(noInitMatch[1], lineNumber);
                continue;
            }

            if (declWithInit.test(trimmed)) {
                continue; // explicitly initialized on declaration - nothing to track
            }

            // fast path: skip the per-variable scan entirely on lines where
            // nothing is currently pending - true for most lines in a file
            if (unset.size === 0) continue;

            const assignMatch = trimmed.match(directAssign);
            if (assignMatch && unset.has(assignMatch[1])) {
                unset.delete(assignMatch[1]);
                continue;
            }

            for (const varName of unset.keys()) {
                const match = new RegExp(`\\b${varName}\\b`).exec(line);
                if (!match) continue;

                diagnostics.push(
                    createDiagnosticError(
                        lineNumber,
                        match.index,
                        match.index + varName.length,
                        "9.1",
                        sawGoto
                            ? `Variable '${varName}' may be read before being set (goto present in this block - verify manually)`
                            : `Variable '${varName}' may be read before being set`
                    )
                );
                unset.delete(varName); // flag once per variable, not on every subsequent read
            }
        }

        return diagnostics;
    }
};