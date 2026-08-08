

const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "15.1",

    check(context) {

        const diagnostics = [];

        const lines = context.lines;
 
        lines.forEach((line, lineNumber) => {

            const index = line.indexOf("goto");

            if (index !== -1) {

                diagnostics.push(
                    createDiagnostic(
                        lineNumber,
                        index,
                        index + 4,
                        "15.1",
                        "The goto <label>; statement shall not be used."
                    )
                );

            }

        });

        return diagnostics;
    }

};