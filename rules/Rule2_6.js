const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "2.6",
    scope: "line",
    title: "Labels shall not be used.",

    checkLine(line, lineNumber) {
        const trimmed = line.trim();

        const labelMatch = trimmed.match(/^[_a-zA-Z][_a-zA-Z0-9]*\s*:/);
        if (!labelMatch) return null;

        const labelName = labelMatch[0];
        const start = line.indexOf(labelName);
        const end = start + labelName.length;

        return createDiagnostic(
            lineNumber,
            start,
            end,
            "2.6",
            "Labels shall not be used."
        );
    }
};