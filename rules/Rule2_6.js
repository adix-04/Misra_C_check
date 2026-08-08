const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "2.6",
    title: "Labels shall not be used.",

    check(context) {

        const diagnostics = [];
        const lines = context.lines;

        lines.forEach((line, lineNumber) => {

            const trimmed = line.trim();

            // Detect C label pattern: identifier followed by colon
            // Example: label1:
            const labelMatch = trimmed.match(/^[_a-zA-Z][_a-zA-Z0-9]*\s*:/);

            if (labelMatch) {

                const labelName = labelMatch[0];

                const start = line.indexOf(labelName);
                const end = start + labelName.length;

                diagnostics.push(
                    createDiagnostic(
                        lineNumber,
                        start,
                        end,
                        "2.6",
                        "Labels shall not be used."
                    )
                );
            }
        });

        return diagnostics;
    }
};