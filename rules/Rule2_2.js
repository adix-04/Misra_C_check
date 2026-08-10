const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "2.2",
    scope: "line",
    title: "Empty statement blocks shall not be used.",

    checkLine(line, lineNumber) {
        const trimmed = line.trim();

        if (trimmed !== "{}" && trimmed !== "{ }") return null;

        const start = line.indexOf("{");

        return createDiagnostic(
            lineNumber,
            start,
            start + 2,
            "2.2", // was "15.1" before — bug fix
            "empty blocks are not allowed"
        );
    }
};