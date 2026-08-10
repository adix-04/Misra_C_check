const { createDiagnostic } = require("../utils/helper");

module.exports = {
    id: "10.1",
    title: "Assignment shall not appear in condition expressions.",
    scope: "line",

    checkLine(line, lineNumber) {
        const trimmed = line.trim();

        if (!trimmed.startsWith("if")) return null;
        if (!trimmed.includes("=")) return null;
        if (trimmed.includes("==")) return null;

        const index = line.indexOf("=");
        return createDiagnostic(
            lineNumber,
            index,
            index + 2,
            "10.1", // was hardcoded "15.1" before
            "Assignment in condition may be unsafe"
        );
    }
};