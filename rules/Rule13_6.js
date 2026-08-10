const { createDiagnostic } = require("../utils/helper");

// side-effect patterns inside a sizeof(...) operand
const incDec = /\+\+|--/;
// assignment ops, but not ==, !=, <=, >=
const assignment = /[+\-*/%&|^]=|<<=|>>=|(?<![=!<>])=(?!=)/;
// identifier immediately (optionally with whitespace) followed by '(' - a function call
const functionCall = /\b[a-zA-Z_]\w*\s*\(/;

function findMatchingClose(line, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < line.length; i++) {
        if (line[i] === "(") depth++;
        else if (line[i] === ")") {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1; // unbalanced on this line - sizeof(...) spans multiple lines
}

module.exports = {

    id: "13.6",
    scope: "line",
    title: "The operand of the sizeof operator shall not contain any expression which has potential side effects",

    checkLine(line, lineNumber) {
        const diagnostics = [];
        const sizeofRegex = /\bsizeof\b/g;
        let match;

        while ((match = sizeofRegex.exec(line)) !== null) {
            let i = match.index + "sizeof".length;
            while (i < line.length && /\s/.test(line[i])) i++;

            if (line[i] !== "(") continue; // "sizeof expr" without parens - not handled, rare in practice

            const openIndex = i;
            const closeIndex = findMatchingClose(line, openIndex);
            if (closeIndex === -1) continue; // spans multiple lines - known gap

            const operand = line.slice(openIndex + 1, closeIndex);

            const offender = incDec.exec(operand) || assignment.exec(operand) || functionCall.exec(operand);
            if (!offender) continue;

            diagnostics.push(
                createDiagnostic(
                    lineNumber,
                    openIndex,
                    closeIndex + 1,
                    "13.6",
                    "The operand of sizeof shall not contain an expression with potential side effects"
                )
            );
        }

        return diagnostics;
    }
};