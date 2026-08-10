// const { createDiagnostic } = require("../utils/helper");

// module.exports = {

//     id: "9.2",
//     title: "Aggregate initializers shall use braces for subobjects",

//     check(context) {

//         const diagnostics = [];
//         const lines = context.lines;

//         for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {

//             const text = lines[lineNumber];

//             // must be initialization line
//             if (!text.includes("=") || !text.includes("{")) continue;

//             // detect array
//             const isArray = /\w+\s+\w+\s*(\[[^\]]+\])+/.test(text);
//             if (!isArray) continue;

//             // count dimensions
//             const dims = (text.match(/\[/g) || []).length;

//             // only care multi-dimensional arrays
//             if (dims < 2) continue;

//             const initPart = text.split("=")[1];

//             // ❌ flat initializer detection
//             const hasNestedBraces = initPart.includes("{") && initPart.includes("{{");

//             if (!hasNestedBraces) {

//                 const col = text.indexOf("{");

//                 diagnostics.push(
//                     createDiagnostic(
//                         lineNumber,
//                         col,
//                         col + text.length,
//                         "9.2",
//                         "Aggregate initializers shall use braces for subobjects"
//                     )
//                 );
//             }
//         }

//         return diagnostics;
//     }
// };
const { createDiagnostic } = require("../utils/helper");

module.exports = {

    id: "9.2",
      scope:"document",
    title: "Aggregate initializers shall use braces for subobjects",

    check(context) {

        const diagnostics = [];
        const text = context.text;

        // match array initialization statements
        const regex = /\w+\s+\w+\s*(\[[^\]]+\])+[^=]*=\s*\{[^;]*\}/g;

        let match;

        while ((match = regex.exec(text)) !== null) {

            const fullStatement = match[0];
            const startIndex = match.index;

            // extract initializer part
            const initSplit = fullStatement.split("=");
            if (initSplit.length < 2) continue;

            const initializer = initSplit[1].trim();

            // -----------------------------
            // EXCEPTION: {0}
            // -----------------------------
            if (initializer.startsWith("{0") || initializer.startsWith("{ 0")) {
                continue;
            }

            // -----------------------------
            // detect multidimensional array usage
            // -----------------------------
            const dims = (fullStatement.match(/\[/g) || []).length;

            if (dims < 2) continue;

            // -----------------------------
            // detect ANY flat (non-braced) element inside initializer
            // -----------------------------
            const inner = initializer
                .replace(/^\{|\}$/g, "")   // remove outer braces
                .split(",");

            let hasFlatElement = false;

            for (const part of inner) {

                const trimmed = part.trim();

                if (!trimmed) continue;

                // if element is NOT brace-enclosed -> violation
                if (!trimmed.startsWith("{") && !trimmed.endsWith("}")) {
                    hasFlatElement = true;
                    break;
                }
            }

            // -----------------------------
            // RULE VIOLATION
            // -----------------------------
            if (hasFlatElement) {

                const before = text.slice(0, startIndex);
                const lineNumber = before.split("\n").length - 1;
                const column = startIndex - before.lastIndexOf("\n") - 1;

                diagnostics.push(
                    createDiagnostic(
                        lineNumber,
                        column,
                        column + fullStatement.length,
                        "9.2",
                        "Aggregate initializers shall use braces for subobjects"
                    )
                );
            }
        }

        return diagnostics;
    }
};