const vscode = require("vscode");
const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "2.2",
    title: "Empty statement blocks shall not be used.",
    check(context) {
        const diagnostics = [];
       // const text = document.getText();
       const lines = context.lines;

        lines.forEach((line, lineNumber) => {

            const trimmed = line.trim();

            // very simple check for empty block
            if (trimmed === "{}" || trimmed === "{ }") {

                const start = line.indexOf("{");

                diagnostics.push(
                    createDiagnostic(
                        lineNumber,
                        start,
                        start + 2,
                        "15.1",
                        "empty blocks are not allowed",
                    )
                );
            }
        });

        return diagnostics;
    }
};