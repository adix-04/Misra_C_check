const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "3.2",
    title: "Line splicing shall not be used in // comments",

    check(context) {

        const diagnostics = [];
        const lines = context.lines;

        lines.forEach((line, lineNumber) => {

            const text = line;

            const commentIndex = text.indexOf("//");

            // Only care if line has a // comment
            if (commentIndex !== -1) {

                const commentText = text.slice(commentIndex + 2);

                const trimmed = commentText.trimEnd();

                // Check if comment ends with backslash
                if (trimmed.endsWith("\\")) {

                    const col = text.lastIndexOf("\\");

                    diagnostics.push(
                        createDiagnostic(
                            lineNumber,
                            col,
                            col + 1,
                            "3.2",
                            "Line splicing (\\) is not allowed in // comments"
                        )
                    );
                }
            }
        });

        return diagnostics;
    }
};