const { createDiagnostic, createDiagnosticError } = require("../utils/helper");

const TYPES = "uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|int|char|float|double|bool_t";
const declNoInit = new RegExp(`\\b(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\s*;`);
const declWithInit = new RegExp(`\\b(?:${TYPES})\\s+([a-zA-Z_]\\w*)\\s*=`);
const directAssign = /\b([a-zA-Z_]\w*)\s*=(?!=)/;
// "&varName" - taking the address, not reading the value (e.g. passed to a function to be set)
function isAddressOf(line, matchIndex) {
    let i = matchIndex - 1;
    while (i >= 0 && /\s/.test(line[i])) i--;
    return i >= 0 && line[i] === "&";
}

module.exports = {

    id: "9.1",
    scope: "document",
    title: "The value of an object with automatic storage duration shall not be read before it has been set",

    check(context) {
        const diagnostics = [];
        const lines = context.lines;

        let braceDepth = 0;
        let unset = new Map();
        let sawGotoInBlock = false; // once true for this block, inline-init lines are no longer trusted

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            const trimmed = line.trim();

            for (const ch of trimmed) {
                if (ch === "{") braceDepth++;
                else if (ch === "}") braceDepth--;
            }
            if (braceDepth <= 0) {
                if (unset.size) unset.clear();
                sawGotoInBlock = false;
                continue;
            }

            if (!sawGotoInBlock && /\bgoto\b/.test(trimmed)) {
                sawGotoInBlock = true;
            }

            const noInitMatch = trimmed.match(declNoInit);
            if (noInitMatch) {
                unset.set(noInitMatch[1], lineNumber);
                continue;
            }

            const withInitMatch = trimmed.match(declWithInit);
            if (withInitMatch) {
                if (sawGotoInBlock) {
                    // a goto earlier in this block may jump past this initializer -
                    // can't trust the inline init, so still track it as unset
                    unset.set(withInitMatch[1], lineNumber);
                }
                continue;
            }

            if (unset.size === 0) continue;

            const assignMatch = trimmed.match(directAssign);
            if (assignMatch && unset.has(assignMatch[1])) {
                unset.delete(assignMatch[1]);
                continue;
            }

            for (const varName of unset.keys()) {
                const regex = new RegExp(`\\b${varName}\\b`, "g");
                let match;
                let flagged = false;
                while ((match = regex.exec(line)) !== null) {
                    if (isAddressOf(line, match.index)) continue; // &var - not a read

                    diagnostics.push(
                        createDiagnosticError(
                            lineNumber,
                            match.index,
                            match.index + varName.length,
                            "9.1",
                            sawGotoInBlock
                                ? `Variable '${varName}' may be read before being set (goto present in this block - verify manually)`
                                : `Variable '${varName}' may be read before being set`
                        )
                    );
                    flagged = true;
                }
                if (flagged) unset.delete(varName);
            }
        }

        return diagnostics;
    }
};