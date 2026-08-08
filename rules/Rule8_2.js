const { createDiagnostic,createDiagnosticError } = require("../utils/helper");

module.exports = {

    id: "8.2",
    title: "Objects shall be initialized before use",

    check(context) {

        const diagnostics = [];
        const lines = context.lines;

        const declared = new Map();   // var -> line
        const assigned = new Set();

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {

            const text = lines[lineNumber];

            // -------------------------
            // detect declaration
            // -------------------------
            const decl = text.match(/\b(uint16_t|int|char|float|double|bool_t)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/);

            if (decl) {
                console.log("detect \n");
                declared.set(decl[2], lineNumber);
                continue;
            }

            // -------------------------
            // detect assignment (real one)
            // -------------------------
            const assign = text.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);

            if (assign) {
                console.log("assign \n");
                assigned.add(assign[1]);
            }

            // -------------------------
            // detect usage in expressions
            // -------------------------

            for (const varName of declared.keys()) {

                const regex = new RegExp(`\\b${varName}\\b`, "g");

                let match;

                while ((match = regex.exec(text)) !== null) {

                    console.log("MATCH:", match[0]);
                    console.log("LINE:", text);

                    diagnostics.push(
                        createDiagnosticError(
                            lineNumber,
                            match.index,
                            match.index + varName.length,
                            "8.2",
                            `Variable '${varName}' may be uninitialized before use`
                        )
                    );
                }
            }
        }

        return diagnostics;
    }
};