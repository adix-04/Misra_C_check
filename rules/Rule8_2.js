const { createDiagnostic, createDiagnosticError } = require("../utils/helper");

const TYPES = "uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|int|char|float|double|bool_t";
const declPattern = new RegExp(`\\b(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\b`);
// "=" not part of "==" - a genuine assignment operator
const assignPattern = /\b([a-zA-Z_]\w*)\s*=(?!=)/;
const hasInlineInit = /=(?!=)/;

module.exports = {

    id: "8.2",
    scope: "document",
    title: "Objects shall be initialized before use",

    check(context) {
        const diagnostics = [];
        const lines = context.lines;

        const declared = new Map(); // varName -> declaration line, tracked only while unset

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const text = lines[lineNumber];

            const decl = text.match(declPattern);
            if (decl) {
                const varName = decl[1];
                const restOfLine = text.slice(decl.index + decl[0].length).split(";")[0];

                if (hasInlineInit.test(restOfLine)) {
                    // e.g. "uint16_t u = 10;" or "int a[2][2] = { 1, 2 };" - initialized inline
                    continue;
                }

                declared.set(varName, lineNumber);
                continue;
            }

            if (declared.size === 0) continue; // fast path - nothing pending on this line

            const assignMatch = text.match(assignPattern);
            if (assignMatch && declared.has(assignMatch[1])) {
                declared.delete(assignMatch[1]); // real assignment satisfies the variable
                continue;
            }

            for (const varName of declared.keys()) {
                const regex = new RegExp(`\\b${varName}\\b`, "g");
                let match;
                while ((match = regex.exec(text)) !== null) {
                    diagnostics.push(
                        createDiagnosticError(
                            lineNumber,
                            match.index,
                            match.index + varName.length,
                            "8.2",
                            `Variable '${varName}' may be uninitialized before use`
                        )
                    );
                }
                declared.delete(varName); // flag once per variable, not on every read
            }
        }

        return diagnostics;
    }
};