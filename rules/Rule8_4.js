const vscode = require("vscode");

const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "10.1",

    title: "Assignment shall not appear in condition expressions.",

    check(context) {

        const diagnostics = [];

        //const text = document.getText();
        const lines = context.lines;

        lines.forEach((line, lineNumber) => {

            const trimmed = line.trim();

            // very simple heuristic: if condition contains '=' but not '=='
            if (trimmed.startsWith("if") &&
                trimmed.includes("=") &&
                !trimmed.includes("==")) {

                const index = line.indexOf("=");
                diagnostics.push(
                    createDiagnostic(
                        lineNumber,
                        index,
                        index + 2,
                        "15.1",
                        "Assignment in condition may be unsafe ",
                    )
                );
             
            }
        });

        return diagnostics;
    }
};