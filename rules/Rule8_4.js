const { createDiagnostic } = require("../utils/helper");

// a bare "=" not part of ==, !=, <=, >=, +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=
const bareAssignment = /(?<![=!<>+\-*/%&|^])=(?!=)/;

module.exports = {
    id: "10.1",
    title: " shall not appear in condition expressions.",
    scope: "line",

    checkLine(line, lineNumber) {
        const trimmed = line.trim();

        if (!trimmed.startsWith("if")) return null;

        const match = bareAssignment.exec(line);
        if (!match) return null;

        return createDiagnostic(
            lineNumber,
            match.index,
            match.index + 1,
            "10.1",
            "Assignment in condition may be unsafe"
        );
    }
};